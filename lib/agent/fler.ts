import { z } from "zod";
import { exaLiknande, exaSok, harExa } from "../exa";
import { parallellt, sok } from "../firecrawl";
import { struktur } from "../llm";
import type { Foretag, Konkurrent } from "../types";
import { KATALOGER, JAMFORELSE, doman, type Kandidat } from "./upptack";

const Schema = z.object({
  konkurrenter: z.array(
    z.object({ namn: z.string(), url: z.string(), varfor: z.string() }),
  ),
});

/**
 * A second sweep, deliberately not the first one again.
 *
 * The first pass asks "who sells this to these people". Running that twice
 * returns the same five companies. So this pass comes at it from two different
 * angles: wording built from the keywords the first pass did not use, and
 * semantic similarity to the competitors we already found — which surfaces the
 * small local players that never rank for a generic keyword.
 */
export async function fleraKonkurrenter(
  egen: Foretag,
  redan: Konkurrent[],
  loggning?: (text: string) => void,
): Promise<Kandidat[]> {
  const svensk = /svensk/i.test(egen.sprak) || /sverige/i.test(egen.geografi);
  const kanda = new Set<string>([doman(egen.url), ...redan.map((k) => doman(k.url))]);

  const fragor = [
    // Keywords the first sweep never used.
    ...egen.nyckelord.slice(2, 4).map((k) => `${k}${svensk ? " Sverige" : ""}`),
    svensk ? `mindre svenska leverantörer av ${egen.nyckelord[0]}` : `smaller providers of ${egen.nyckelord[0]}`,
    `${egen.nyckelord[0]} for ${egen.malgrupp.split(/[,.;]/)[0].trim().slice(0, 40)}`,
  ].filter((f) => f && f.trim().length > 3);

  const traffar = await parallellt(fragor, 4, async (fraga) => {
    loggning?.(`Searching: "${fraga}"`);
    try {
      if (harExa()) {
        const ut = await exaSok(fraga, { antal: 6 });
        return ut.map((t) => ({ url: t.url, title: t.title, description: "" }));
      }
      return await sok(fraga, { limit: 6, land: "Sweden" });
    } catch (e) {
      console.error("[fler] search:", e instanceof Error ? e.message : e);
      return [];
    }
  });

  // Similarity to the competitors we already have, which is where the small
  // local players hide.
  const liknande = harExa()
    ? await parallellt(redan.slice(0, 3), 3, async (k) => {
        loggning?.(`Looking for companies like ${k.namn}`);
        try {
          const ut = await exaLiknande(k.url, { antal: 6 });
          return ut.map((t) => ({ url: t.url, title: t.title, description: "" }));
        } catch (e) {
          console.error("[fler] findSimilar:", e instanceof Error ? e.message : e);
          return [];
        }
      })
    : [];

  const rader: string[] = [];
  const sedda = new Set(kanda);
  for (const grupp of [...traffar, ...liknande]) {
    for (const t of grupp) {
      const d = doman(t.url);
      if (sedda.has(d)) continue;
      sedda.add(d);
      const katalog = KATALOGER.some((k) => d.endsWith(k));
      if (katalog || JAMFORELSE.test(t.title ?? "") || JAMFORELSE.test(d)) continue;
      rader.push(`${d} — ${t.title ?? ""}`);
    }
  }

  if (!rader.length) return [];

  const ut = await struktur(
    `You are finding competitors a first pass missed.

# The company
${egen.namn} (${egen.url})
Sells: ${egen.vadNiSaljer}
To: ${egen.malgrupp}
Market: ${egen.geografi}

# Already found — do NOT return any of these
${redan.map((k) => `${doman(k.url)} (${k.namn})`).join("\n")}

# New candidates
${rader.slice(0, 30).join("\n")}

# Task
Pick at most 3 that genuinely compete with ${egen.namn} for the same customers
and are not already in the list above.
Rules:
- Never include a directory, comparison site, social network or news article.
- A near-identical company NAME is not evidence of competition. Judge by what
  they appear to sell.
- If fewer than 3 are genuine competitors, return fewer. Returning none is a
  correct answer.
- "url" must be the company's own home page, https, no path.
- "varfor" is one short sentence, in the same language as the company's site.

Answer with ONLY valid JSON, no prose, no markdown fence:
{"konkurrenter":[{"namn":"","url":"","varfor":""}]}`,
    Schema,
    { timeoutMs: 90_000, forsok: 1 },
  ).catch((e) => {
    console.error("[fler] ranking:", e instanceof Error ? e.message : e);
    return { konkurrenter: [] };
  });

  const rensade: Kandidat[] = [];
  const tagna = new Set(kanda);
  for (const k of ut.konkurrenter.slice(0, 3)) {
    const d = doman(k.url);
    if (tagna.has(d) || KATALOGER.some((kat) => d.endsWith(kat))) continue;
    if (JAMFORELSE.test(k.namn) || JAMFORELSE.test(d)) continue;
    tagna.add(d);
    rensade.push({ ...k, url: `https://${d}` });
  }
  return rensade;
}
