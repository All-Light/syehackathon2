import { z } from "zod";
import { exaSok, harExa } from "../exa";
import { parallellt, sok, type SokTraff } from "../firecrawl";
import { struktur } from "../llm";
import type { Foretag } from "../types";

/** Directories and marketplaces are not competitors — they are where we find them. */
const KATALOGER = [
  "wikipedia.org", "linkedin.com", "crunchbase.com", "g2.com", "capterra.com",
  "reddit.com", "youtube.com", "facebook.com", "instagram.com", "trustpilot.com",
  "allabolag.se", "bolagsfakta.se", "ratsit.se", "hitta.se", "eniro.se",
  "producthunt.com", "medium.com", "quora.com", "prisjakt.nu",
];

export type Kandidat = { namn: string; url: string; varfor: string };

/** "Bästa bokföringsprogram 2026" is a listicle, not a competitor. */
const JAMFORELSE = /\b(j[aä]mf[oö]r|b[aä]st[ae]?|topp\s*\d|test|guide|recension|reviews?|alternatives?|vs)\b|\b20\d\d\b/i;

function domän(url: string): string {
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

  const fragor = harExa()
    ? [
        `${egen.nyckelord[0]} för ${egen.malgrupp}${svensk ? " i Sverige" : ""}`,
        `företag som erbjuder ${egen.vadNiSaljer.slice(0, 90)}`,
        `alternativ till ${egen.namn}`,
      ]
    : [
        ...egen.nyckelord.slice(0, 2).map((k) => `${k} ${svensk ? "Sverige" : ""}`.trim()),
        `alternativ till ${egen.namn}`,
        `${egen.namn} konkurrenter`,
      ];

  const traffar = await parallellt(fragor, 4, async (fraga) => {
    loggning?.(`Söker: "${fraga}"`);
    try {
      if (harExa()) {
        const ut = await exaSok(fraga, { antal: 7 });
        return ut.map((t) => ({ url: t.url, title: t.title, description: "" }));
      }
      return await sok(fraga, { limit: 6, land: "Sweden" });
    } catch (e) {
      console.error("[upptack] sök:", e instanceof Error ? e.message : e);
      return [] as SokTraff[];
    }
  });

  const egenDoman = domän(egen.url);
  const sedda = new Set<string>([egenDoman]);
  const rader: string[] = [];
  // If the ranking call fails we still have something to research.
  const reserv: Kandidat[] = [];

  for (const grupp of traffar) {
    for (const t of grupp) {
      const d = domän(t.url);
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
        reserv.push({ namn: rubrik || d, url: `https://${d}`, varfor: "Dök upp högt i sökningarna." });
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

  const bygg = (antal: number) => `Du väljer ut vilka företag som faktiskt konkurrerar med ett annat företag.

# Företaget
${egen.namn} (${egen.url})
Säljer: ${egen.vadNiSaljer}
Till: ${egen.malgrupp}
Marknad: ${egen.geografi}

${angivna.length ? `# Användaren har redan pekat ut dessa\n${angivna.join("\n")}\n` : ""}
# Sökträffar
Rader märkta [KATALOG] är kataloger, jämförelsesajter eller sociala medier. De är
INTE konkurrenter — men namn som nämns i deras beskrivningar kan vara det.

${rader.slice(0, antal).join("\n")}

# Uppgift
Välj de ${Math.max(1, 4 - angivna.length)} företag som mest sannolikt konkurrerar om samma kunder.
Regler:
- Ta ALDRIG med ${egenDoman} själv.
- Ta aldrig med en katalog, en jämförelsesajt, ett socialt nätverk eller en nyhetsartikel.
- "url" ska vara företagets egen startsida, https, utan sökväg.
- Föredra företag på samma marknad (${egen.geografi}) framför globala jättar.
- "varfor" är en kort mening om varför de konkurrerar. Var konkret.

Svara med ENBART giltig JSON:
{"konkurrenter":[{"namn":"","url":"","varfor":""}]}`;

  // Latency on this call swings from 5 s to 45 s on the same prompt shape.
  // Try once with everything, then again with a third of the rows, and only
  // then fall back — inventing competitors is worse than admitting failure.
  const ut =
    (await struktur(bygg(32), Schema, { timeoutMs: 150_000, forsok: 1 }).catch((e) => {
      console.error("[upptack] rankning 1:", e instanceof Error ? e.message : e);
      loggning?.("Rankningen tog för lång tid — försöker med färre träffar");
      return null;
    })) ??
    (await struktur(bygg(12), Schema, { timeoutMs: 90_000, forsok: 1 }).catch((e) => {
      console.error("[upptack] rankning 2:", e instanceof Error ? e.message : e);
      loggning?.("Rankningen svarade inte — går på sökträffarna i stället");
      return { konkurrenter: reserv };
    }));

  const rensade: Kandidat[] = [];
  const tagna = new Set<string>([egenDoman]);
  for (const k of ut.konkurrenter.slice(0, 8)) {
    const d = domän(k.url);
    if (tagna.has(d) || KATALOGER.some((kat) => d.endsWith(kat))) continue;
    if (JAMFORELSE.test(k.namn) || JAMFORELSE.test(d)) continue;
    tagna.add(d);
    rensade.push({ ...k, url: `https://${d}` });
  }
  return rensade;
}
