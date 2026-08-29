import { createHash } from "node:crypto";
import { z } from "zod";
import { karta, parallellt, skrapa, type Lank, type Sida } from "../firecrawl";
import { struktur } from "../llm";
import type { BevakadSida, Konkurrent, Prisniva, SidTyp } from "../types";
import type { Kandidat } from "./upptack";
import { hamtaOrgdata, plockaOrgnr } from "./orgdata";
import { kortaCitat } from "../citat";
import { sprakInstruktion } from "./sprak";

const KonkurrentSchema = z.object({
  positionering: z.string(),
  malgrupp: z.string(),
  priser: z.array(
    z.object({
      namn: z.string(),
      pris: z.string(),
      period: z.string().nullable(),
      citat: z.string(),
      kallURL: z.string(),
    }),
  ),
  funktioner: z.array(z.string()),
  styrkor: z.array(z.string()),
  svagheter: z.array(z.string()),
});

export type HamtadSida = { url: string; typ: SidTyp; sida: Sida };

type Val = { url: string; typ: SidTyp };

const MÖNSTER: { typ: SidTyp; re: RegExp; vikt: number }[] = [
  // Swedish sites call it /priser, /prislista, /paket or /abonnemang as often
  // as /pricing. A page named for the price list beats one named for the bundle:
  // Fortnox's /paket is prose about costs, /produkt/prislista is the actual table.
  { typ: "pris", re: /\/(pricing|prices?|pris[a-zåäö]*)/i, vikt: 100 },
  { typ: "pris", re: /\/(paket|plans?|abonnemang|kostnad)/i, vikt: 90 },
  { typ: "produkt", re: /\/(product|produkt|features?|funktioner|tjanster|tjänster|services?)/i, vikt: 50 },
  { typ: "om", re: /\/(about|om-oss|om|company|foretaget|företaget)/i, vikt: 30 },
  { typ: "nyheter", re: /\/(changelog|releases?|news|nyheter|blog|blogg)/i, vikt: 20 },
];

const UNDVIK =
  /\/(privacy|integritet|terms|villkor|cookie|jobs?|careers?|jobb|contact|kontakt|login|signin|support|help|docs?)/i;

/**
 * Pattern-match first, ask the model only when the patterns find nothing.
 * A pricing page is called /pricing or /priser on almost every site, and an
 * LLM call per competitor to rediscover that costs half a minute of the demo.
 */
function valjSidor(startsida: string, lankar: Lank[]): Val[] {
  const poang = new Map<string, { typ: SidTyp; vikt: number }>();

  for (const l of lankar) {
    if (UNDVIK.test(l.url)) continue;
    for (const m of MÖNSTER) {
      if (m.re.test(l.url)) {
        const fanns = poang.get(l.url);
        if (!fanns || fanns.vikt < m.vikt) poang.set(l.url, { typ: m.typ, vikt: m.vikt });
        break;
      }
    }
  }

  const valda = [...poang.entries()]
    .sort((a, b) => b[1].vikt - a[1].vikt)
    // One page of each kind. Four /blog/ posts tell us nothing four times.
    .filter((rad, _i, alla) => alla.findIndex((x) => x[1].typ === rad[1].typ) === alla.indexOf(rad))
    .slice(0, 2)
    .map(([url, v]) => ({ url, typ: v.typ }));

  const harStart = valda.some((v) => v.url.replace(/\/$/, "") === startsida.replace(/\/$/, ""));
  return harStart ? valda : [{ url: startsida, typ: "produkt" as SidTyp }, ...valda].slice(0, 2);
}

/** Markdown emphasis and table pipes must not make a real quote look invented. */
function normalisera(s: string): string {
  return s
    .toLowerCase()
    .replace(/[*_`#|>\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedup<T>(poster: T[], nyckel: (p: T) => string): T[] {
  const sedda = new Set<string>();
  return poster.filter((p) => {
    const k = nyckel(p);
    if (sedda.has(k)) return false;
    sedda.add(k);
    return true;
  });
}

export type Detaljer = {
  positionering: string;
  malgrupp: string;
  priser: Prisniva[];
  funktioner: string[];
  styrkor: string[];
  svagheter: string[];
};

/**
 * Extraction over pages already in hand. Separate from fetching them so a
 * monitoring check can re-read exactly the pages it baselined, rather than
 * re-running page selection and landing on a different pricing page.
 */
export async function bearbeta(
  namn: string,
  url: string,
  levande: HamtadSida[],
  svensk: boolean,
): Promise<Detaljer | null> {
  if (!levande.length) return null;

  const detaljer = await struktur(
    `You are summarising a competitor from their own pages.
${sprakInstruktion(svensk)}

# Competitor
${namn} — ${url}

# The pages
${levande
  .map(
    (l) =>
      `## ${l.typ.toUpperCase()} — ${l.sida.url}\n${l.sida.markdown.slice(0, l.typ === "pris" ? 6_000 : 2_500)}`,
  )
  .join("\n\n")}

# Task
- "priser": every price tier that ACTUALLY appears on the pages. "citat" must be
  verbatim from the text above and must contain the price. "kallURL" is the page
  the quote is on. If no price is published, leave the list empty.
  NEVER invent a price.
- "funktioner": what the product does, short bullets, in their own words.
- "styrkor" and "svagheter": what the pages let you conclude. A weakness can be
  something missing — no published price, no Swedish site, a narrow audience.
- "positionering": one sentence on how they present themselves.
- "malgrupp": who they are selling to.

# Quoting
- A quote is evidence, not content. Keep every "citat" under 20 words, in the
  words of the page, and never more than one quote from the same page.
- If you are not confident which page a statement came from, set the source to
  null. An unattributed finding is honest; a guessed attribution is not.
- Never reproduce a page's text at length. Summarise in your own words and let
  the short quote carry the proof.

Answer with ONLY valid JSON, no prose, no markdown fence:
{"positionering":"","malgrupp":"","priser":[{"namn":"","pris":"","period":null,"citat":"","kallURL":""}],"funktioner":[],"styrkor":[],"svagheter":[]}`,
    KonkurrentSchema,
    { timeoutMs: 75_000 },
  ).catch((e) => {
    console.error(`[undersok] ${namn}:`, e instanceof Error ? e.message : e);
    return null;
  });

  if (!detaljer) return null;

  const text = normalisera(levande.map((l) => l.sida.markdown).join("\n"));

  return {
    positionering: detaljer.positionering,
    malgrupp: detaljer.malgrupp,
    // A price whose quote is not on a page we actually read is a hallucination.
    priser: dedup(
      detaljer.priser.filter((p) => {
        const c = normalisera(p.citat ?? "");
        const ok = c.length >= 6 && text.includes(c.slice(0, 30));
        if (!ok) {
          console.warn(`[pris] ${namn}: dropped "${p.namn} ${p.pris}" — quote not found on the page`);
        }
        return ok;
      }),
      (p) => `${normalisera(p.namn)}|${normalisera(p.pris)}`,
    )
      .slice(0, 6)
      .map((p) => ({
        namn: p.namn,
        pris: p.pris,
        period: p.period,
        kalla: { url: p.kallURL, citat: kortaCitat(p.citat) },
      })),
    funktioner: detaljer.funktioner.slice(0, 8),
    styrkor: detaljer.styrkor.slice(0, 4),
    svagheter: detaljer.svagheter.slice(0, 4),
  };
}

export function bevakad(l: HamtadSida): BevakadSida {
  return {
    url: l.sida.url,
    typ: l.typ,
    hash: createHash("sha256").update(l.sida.markdown).digest("hex").slice(0, 16),
    hamtad: new Date().toISOString(),
  };
}

/** The pages a Swedish company puts its org number on when the footer does not,
 *  best first — only the first three are read, so the order matters. */
const JURIDISK: RegExp[] = [
  /\/(kontakt|contact)/i,
  /\/(om-oss|about|company|foretaget|företaget)/i,
  /\/(villkor|anvandarvillkor|användarvillkor|terms|legal|impressum)/i,
  /\/(integritet\w*|privacy|dataskydd|gdpr)/i,
];

/** Tags out, entities in, so a footer's "Org.nr&nbsp;556469-6291" reads as text. */
function textAvHtml(html: string): string {
  return html
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");
}

/** A plain GET. No Firecrawl, so no credit and no rate-limit slot — which is
 *  the whole reason this is tried before anything else. */
async function raSida(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: {
        // Some Swedish sites hand a bare fetch a consent wall instead of a page.
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) return null;
    return textAvHtml(await r.text());
  } catch {
    return null;
  }
}

/**
 * The org number, cheapest source first.
 *
 * A Swedish company must publish it, and unlike a brand name it is exact:
 * "Redofy" matches three unrelated registrations, 559538-6219 matches exactly
 * one company. So it is worth looking for — but not worth Firecrawl credit,
 * which is why neither step here spends any:
 *
 *   1. the markdown we already scraped. Free, but usually a miss: those scrapes
 *      run with onlyMainContent, which strips the footer the number lives in.
 *   2. the raw HTML of the start page and up to three legal/contact pages, over
 *      a plain GET. Also free — no credit, no rate-limit slot — and this is the
 *      step that lands, because the footer is in the served HTML of any
 *      server-rendered site.
 *
 * A third step was tried and dropped: one Firecrawl scrape of the best legal
 * page, to reach footers that are only rendered in JavaScript. Measured over
 * fortnox.se, enkelbok.se, redofy.se, qvitta.se and accounted.se it found not
 * one number the free steps had missed, while costing a request for every
 * competitor whose site publishes none. Those fall back to the name search,
 * exactly as they did before.
 */
async function hittaOrgnr(
  kandidat: Kandidat,
  levande: HamtadSida[],
  lankar: Lank[],
  loggning?: (text: string) => void,
): Promise<string | null> {
  const rapportera = (t: { orgnr: string; citat: string }, kalla: string) => {
    loggning?.(`Found org number ${t.orgnr} for ${kandidat.namn}`);
    console.log(`[orgnr] ${kandidat.namn}: ${t.orgnr} from ${kalla} — "${t.citat}"`);
    return t.orgnr;
  };

  const redan = plockaOrgnr(levande.map((l) => l.sida.markdown).join("\n"));
  if (redan) return rapportera(redan, "the pages already scraped");

  const juridiska = lankar
    .map((l) => ({ url: l.url, rang: JURIDISK.findIndex((re) => re.test(l.url)) }))
    .filter((l) => l.rang >= 0)
    .sort((a, b) => a.rang - b.rang)
    .map((l) => l.url)
    .slice(0, 3);
  const gratis = [kandidat.url, ...juridiska];

  const rader = await parallellt(gratis, 3, raSida);
  for (let i = 0; i < rader.length; i++) {
    const t = rader[i] ? plockaOrgnr(rader[i]!) : null;
    if (t) return rapportera(t, gratis[i]);
  }

  // No number published where we can read it. hamtaOrgdata falls back to the
  // name search, guard and all.
  return null;
}

/** Step 03. The agent picks which pages are worth the scrape, then reads them. */
export async function undersokKonkurrent(
  kandidat: Kandidat,
  hittadAv: "du" | "agenten",
  svensk: boolean,
  loggning?: (text: string) => void,
): Promise<Konkurrent> {
  loggning?.(`Mapping ${kandidat.namn}`);

  const lankar = await karta(kandidat.url, {
    search: svensk ? "priser prenumeration om oss" : "pricing plans about",
    limit: 25,
  }).catch(() => [] as Lank[]);

  const valda = valjSidor(kandidat.url, lankar);

  const hamtade = await parallellt(valda, 3, async (s) => {
    const vag = (() => {
      try {
        const p = new URL(s.url).pathname;
        return p === "/" ? s.url : p;
      } catch {
        return s.url;
      }
    })();
    loggning?.(`Reading ${vag} on ${kandidat.namn}`);
    const sida = await skrapa(s.url);
    return sida ? { url: s.url, typ: s.typ, sida } : null;
  });

  const levande = hamtade.filter((x): x is HamtadSida => x !== null);

  const [detaljer, orgdata] = await Promise.all([
    bearbeta(kandidat.namn, kandidat.url, levande, svensk),
    // Look the number up first and the register second. hamtaOrgdata falls back
    // to the old name search on its own when the site publishes no number.
    svensk
      ? hittaOrgnr(kandidat, levande, lankar, loggning).then((orgnr) =>
          hamtaOrgdata(kandidat.namn, orgnr),
        )
      : Promise.resolve(null),
  ]);

  return {
    namn: kandidat.namn,
    url: kandidat.url,
    hittadAv,
    varfor: kandidat.varfor,
    positionering: detaljer?.positionering ?? "Could not be read.",
    malgrupp: detaljer?.malgrupp ?? "",
    priser: detaljer?.priser ?? [],
    funktioner: detaljer?.funktioner ?? [],
    styrkor: detaljer?.styrkor ?? [],
    svagheter: detaljer?.svagheter ?? [],
    orgdata,
    sidor: levande.map(bevakad),
  };
}
