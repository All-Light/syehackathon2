import { z } from "zod";
import { exaSok, harExa } from "../exa";
import { parallellt, sok, type SokTraff } from "../firecrawl";
import { struktur } from "../llm";
import type { Foretag } from "../types";

/** Directories and marketplaces are not competitors — they are where we find them. */
export const KATALOGER = [
  "wikipedia.org", "linkedin.com", "crunchbase.com", "g2.com", "capterra.com",
  "reddit.com", "youtube.com", "facebook.com", "instagram.com", "trustpilot.com",
  "allabolag.se", "bolagsfakta.se", "ratsit.se", "hitta.se", "eniro.se",
  "producthunt.com", "medium.com", "quora.com", "prisjakt.nu",
];

export type Kandidat = { namn: string; url: string; varfor: string };

/** "Bästa bokföringsprogram 2026" is a listicle, not a competitor. */
export const JAMFORELSE = /\b(j[aä]mf[oö]r|b[aä]st[ae]?|topp\s*\d|test|guide|recension|reviews?|alternatives?|vs)\b|\b20\d\d\b/i;

export function doman(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Step 02. The part a chat box cannot do: the agent writes its own queries,
 * in the site's own language, and proposes competitors nobody named.
 */
export async function upptackKonkurrenter(
  egen: Foretag,
  angivna: string[],
  loggning?: (text: string) => void,
): Promise<Kandidat[]> {
  const svensk = /svensk/i.test(egen.sprak) || /sverige/i.test(egen.geografi);

  // Neural search wants a short description, not a pasted sentence: the audience
  // field is often a full clause and drags the query off target.
  const kort = egen.malgrupp.split(/[,.;]/)[0].trim().slice(0, 45);
  const fragor = harExa()
    ? [
        `${egen.nyckelord[0]} for ${kort}${svensk ? " i Sverige" : ""}`,
        `companies offering ${egen.vadNiSaljer.slice(0, 80)}`,
        `alternatives to ${egen.namn}`,
      ]
    : [
        ...egen.nyckelord.slice(0, 2).map((k) => `${k} ${svensk ? "Sverige" : ""}`.trim()),
        `alternativ till ${egen.namn}`,
        `${egen.namn} konkurrenter`,
      ];

  const traffar = await parallellt(fragor, 4, async (fraga) => {
    loggning?.(`Searching: "${fraga}"`);
    try {
      if (harExa()) {
        const ut = await exaSok(fraga, { antal: 10 });
        return ut.map((t) => ({ url: t.url, title: t.title, description: "" }));
      }
      return await sok(fraga, { limit: 8, land: "Sweden" });
    } catch (e) {
      console.error("[upptack] sök:", e instanceof Error ? e.message : e);
      return [] as SokTraff[];
    }
  });

  const egenDoman = doman(egen.url);
  const sedda = new Set<string>([egenDoman]);
  const rader: string[] = [];
  // If the ranking call fails we still have something to research.
  const reserv: Kandidat[] = [];

  for (const grupp of traffar) {
    for (const t of grupp) {
      const d = doman(t.url);
      if (sedda.has(d)) continue;
      sedda.add(d);
      const katalog = KATALOGER.some((k) => d.endsWith(k));
      rader.push(
        `${katalog ? "[KATALOG] " : ""}${d} — ${t.title ?? ""} — ${(t.description ?? "").slice(0, 110)}`,
      );
      const listicle = JAMFORELSE.test(t.title ?? "") || JAMFORELSE.test(d);
      const rubrik = (t.title ?? "").split(/[|–—:]/)[0].trim();
      // A company name is short. "Så tjänar dina konkurrenter pengar" is an article.
      if (!katalog && !listicle && rubrik.split(/\s+/).length <= 3) {
        reserv.push({ namn: rubrik || d, url: `https://${d}`, varfor: "Ranked high in the searches." });
      }
    }
  }

  const Schema = z.object({
    konkurrenter: z
      .array(
        z.object({
          namn: z.string(),
          url: z.string(),
          varfor: z.string(),
        }),
      ),
  });

  const bygg = (antal: number) => `You are picking which companies actually compete with another company.

# The company
${egen.namn} (${egen.url})
Sells: ${egen.vadNiSaljer}
To: ${egen.malgrupp}
Market: ${egen.geografi}

${angivna.length ? `# The user already named these\n${angivna.join("\n")}\n` : ""}
# Search results
Lines marked [KATALOG] are directories, comparison sites or social networks.
They are NOT competitors — but companies named in their descriptions may be.

${rader.slice(0, antal).join("\n")}

# Task
List EVERY company here that plausibly competes with ${egen.namn} for the same
customers — up to 15 — ordered most-likely-competitor first. We read the top few
in depth and show the rest as a list, so a company you are unsure about belongs
at the bottom of the list rather than left out.
Rules:
- NEVER include ${egenDoman} itself.
- Never include a directory, a comparison site, a social network or a news article.
- "url" must be the company's own home page, https, no path.
- Prefer companies in the same market (${egen.geografi}) over global giants.
- "namn" is the company name alone, not a page title.
- "varfor" is one short sentence on why they compete, in the same language as
  the company's own site. Be concrete.

Answer with ONLY valid JSON, no prose, no markdown fence:
{"konkurrenter":[{"namn":"","url":"","varfor":""}]}`;

  // Latency on this call swings from 5 s to 45 s on the same prompt shape.
  // Try once with everything, then again with a third of the rows, and only
  // then fall back — inventing competitors is worse than admitting failure.
  const ut =
    (await struktur(bygg(40), Schema, { timeoutMs: 150_000, forsok: 1 }).catch((e) => {
      console.error("[upptack] rankning 1:", e instanceof Error ? e.message : e);
      loggning?.("Ranking took too long — retrying with fewer results");
      return null;
    })) ??
    (await struktur(bygg(12), Schema, { timeoutMs: 90_000, forsok: 1 }).catch((e) => {
      console.error("[upptack] rankning 2:", e instanceof Error ? e.message : e);
      loggning?.("Ranking did not answer — falling back to the search results");
      return { konkurrenter: reserv };
    }));

  const rensade: Kandidat[] = [];
  const tagna = new Set<string>([egenDoman]);
  for (const k of ut.konkurrenter.slice(0, 15)) {
    const d = doman(k.url);
    if (tagna.has(d) || KATALOGER.some((kat) => d.endsWith(kat))) continue;
    if (JAMFORELSE.test(k.namn) || JAMFORELSE.test(d)) continue;
    tagna.add(d);
    rensade.push({ ...k, url: `https://${d}` });
  }
  return rensade;
}
