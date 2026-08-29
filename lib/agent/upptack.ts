import { z } from "zod";
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

  const fragor = [
    ...egen.nyckelord.slice(0, 2).map((k) => `${k} ${svensk ? "Sverige" : ""}`.trim()),
    `alternativ till ${egen.namn}`,
    `${egen.namn} konkurrenter`,
  ].filter(Boolean);

  const traffar = await parallellt(fragor, 4, async (fraga) => {
    loggning?.(`Söker: "${fraga}"`);
    try {
      return await sok(fraga, { limit: 6, land: svensk ? "Sweden" : "Sweden" });
    } catch {
      return [] as SokTraff[];
    }
  });

  const egenDoman = domän(egen.url);
  const sedda = new Set<string>([egenDoman]);
  const rader: string[] = [];

  for (const grupp of traffar) {
    for (const t of grupp) {
      const d = domän(t.url);
      if (sedda.has(d)) continue;
      sedda.add(d);
      const katalog = KATALOGER.some((k) => d.endsWith(k));
      rader.push(
        `${katalog ? "[KATALOG] " : ""}${d} — ${t.title ?? ""} — ${(t.description ?? "").slice(0, 200)}`,
      );
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

  const p = `Du väljer ut vilka företag som faktiskt konkurrerar med ett annat företag.

# Företaget
${egen.namn} (${egen.url})
Säljer: ${egen.vadNiSaljer}
Till: ${egen.malgrupp}
Marknad: ${egen.geografi}

${angivna.length ? `# Användaren har redan pekat ut dessa\n${angivna.join("\n")}\n` : ""}
# Sökträffar
Rader märkta [KATALOG] är kataloger, jämförelsesajter eller sociala medier. De är
INTE konkurrenter — men namn som nämns i deras beskrivningar kan vara det.

${rader.slice(0, 60).join("\n")}

# Uppgift
Välj de ${Math.max(1, 5 - angivna.length)} företag som mest sannolikt konkurrerar om samma kunder.
Regler:
- Ta ALDRIG med ${egenDoman} själv.
- Ta aldrig med en katalog, en jämförelsesajt, ett socialt nätverk eller en nyhetsartikel.
- "url" ska vara företagets egen startsida, https, utan sökväg.
- Föredra företag på samma marknad (${egen.geografi}) framför globala jättar.
- "varfor" är en kort mening om varför de konkurrerar. Var konkret.

Svara med ENBART giltig JSON:
{"konkurrenter":[{"namn":"","url":"","varfor":""}]}`;

  const ut = await struktur(p, Schema);

  const rensade: Kandidat[] = [];
  const tagna = new Set<string>([egenDoman]);
  for (const k of ut.konkurrenter.slice(0, 8)) {
    const d = domän(k.url);
    if (tagna.has(d) || KATALOGER.some((kat) => d.endsWith(kat))) continue;
    tagna.add(d);
    rensade.push({ ...k, url: `https://${d}` });
  }
  return rensade;
}
