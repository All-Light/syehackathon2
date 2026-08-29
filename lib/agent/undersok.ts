import { createHash } from "node:crypto";
import { z } from "zod";
import { karta, parallellt, skrapa, type Lank, type Sida } from "../firecrawl";
import { struktur } from "../llm";
import type { BevakadSida, Konkurrent, Prisniva, SidTyp } from "../types";
import type { Kandidat } from "./upptack";
import { hamtaOrgdata } from "./orgdata";
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
        kalla: { url: p.kallURL, citat: p.citat },
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
    svensk ? hamtaOrgdata(kandidat.namn) : Promise.resolve(null),
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
