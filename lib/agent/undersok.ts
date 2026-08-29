import { createHash } from "node:crypto";
import { z } from "zod";
import { karta, parallellt, skrapa, type Lank, type Sida } from "../firecrawl";
import { struktur } from "../llm";
import type { BevakadSida, Konkurrent, SidTyp } from "../types";
import type { Kandidat } from "./upptack";
import { hamtaOrgdata } from "./orgdata";

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

type Val = { url: string; typ: SidTyp };

const MÖNSTER: { typ: SidTyp; re: RegExp; vikt: number }[] = [
  { typ: "pris", re: /\/(pricing|prices?|priser|prisplan|plans?|abonnemang|kostnad)/i, vikt: 100 },
  { typ: "produkt", re: /\/(product|produkt|features?|funktioner|tjanster|tjänster|services?)/i, vikt: 50 },
  { typ: "om", re: /\/(about|om-oss|om|company|foretaget|företaget)/i, vikt: 30 },
  { typ: "nyheter", re: /\/(changelog|releases?|news|nyheter|blog|blogg)/i, vikt: 20 },
];

const UNDVIK = /\/(privacy|integritet|terms|villkor|cookie|jobs?|careers?|jobb|contact|kontakt|login|signin|support|help|docs?)/i;

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
    .slice(0, 3)
    .map(([url, v]) => ({ url, typ: v.typ }));

  const harStart = valda.some((v) => v.url.replace(/\/$/, "") === startsida.replace(/\/$/, ""));
  return harStart ? valda : [{ url: startsida, typ: "produkt" as SidTyp }, ...valda].slice(0, 3);
}

/** Markdown emphasis and table pipes must not make a real quote look invented. */
function normalisera(s: string): string {
  return s
    .toLowerCase()
    .replace(/[*_`#|>\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Step 03. The agent picks which pages are worth the scrape, then reads them. */
export async function undersokKonkurrent(
  kandidat: Kandidat,
  hittadAv: "du" | "agenten",
  svensk: boolean,
  loggning?: (text: string) => void,
): Promise<Konkurrent> {
  loggning?.(`Kartlägger ${kandidat.namn}`);

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
    loggning?.(`Läser ${vag} hos ${kandidat.namn}`);
    const sida = await skrapa(s.url);
    return sida ? { ...s, sida } : null;
  });

  const levande = hamtade.filter((x): x is { url: string; typ: SidTyp; sida: Sida } => x !== null);

  const sidor: BevakadSida[] = levande.map((l) => ({
    url: l.sida.url,
    typ: l.typ,
    hash: createHash("sha256").update(l.sida.markdown).digest("hex").slice(0, 16),
    hamtad: new Date().toISOString(),
  }));

  const [detaljer, orgdata] = await Promise.all([
    levande.length
      ? struktur(
          `Du sammanfattar en konkurrent utifrån deras egna sidor.

# Konkurrent
${kandidat.namn} — ${kandidat.url}

# Sidorna
${levande
  .map((l) => `## ${l.typ.toUpperCase()} — ${l.sida.url}\n${l.sida.markdown.slice(0, 4_500)}`)
  .join("\n\n")}

# Uppgift
- "priser": varje prisnivå som FAKTISKT står på sidorna. "citat" måste vara ordagrant
  från texten ovan och innehålla priset. "kallURL" är sidan citatet står på.
  Finns inget pris publicerat: lämna listan tom. Hitta ALDRIG på ett pris.
- "funktioner": vad produkten gör, korta punkter, deras egna ord.
- "styrkor" och "svagheter": vad man kan utläsa av sidorna. Svagheter kan vara
  saker som saknas — inget publicerat pris, ingen svensk sajt, smal målgrupp.
- "positionering": en mening om hur de framställer sig.

Svara med ENBART giltig JSON:
{"positionering":"","malgrupp":"","priser":[{"namn":"","pris":"","period":null,"citat":"","kallURL":""}],"funktioner":[],"styrkor":[],"svagheter":[]}`,
          KonkurrentSchema,
        ).catch((e) => {
          console.error(`[undersok] ${kandidat.namn}:`, e instanceof Error ? e.message : e);
          return null;
        })
      : Promise.resolve(null),
    svensk ? hamtaOrgdata(kandidat.namn) : Promise.resolve(null),
  ]);

  const text = normalisera(levande.map((l) => l.sida.markdown).join("\n"));

  return {
    namn: kandidat.namn,
    url: kandidat.url,
    hittadAv,
    varfor: kandidat.varfor,
    positionering: detaljer?.positionering ?? "Kunde inte läsas.",
    malgrupp: detaljer?.malgrupp ?? "",
    // A price whose quote is not on a page we actually read is a hallucination.
    priser: dedup(
      (detaljer?.priser ?? []).filter((p) => {
        const c = normalisera(p.citat ?? "");
        return c.length >= 6 && text.includes(c.slice(0, 30));
      }),
      (p) => `${normalisera(p.namn)}|${normalisera(p.pris)}`,
    ).map((p) => ({
      namn: p.namn,
      pris: p.pris,
      period: p.period,
      kalla: { url: p.kallURL, citat: p.citat },
    })),
    funktioner: (detaljer?.funktioner ?? []).slice(0, 8),
    styrkor: (detaljer?.styrkor ?? []).slice(0, 4),
    svagheter: (detaljer?.svagheter ?? []).slice(0, 4),
    orgdata,
    sidor,
  };
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
