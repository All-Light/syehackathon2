import { z } from "zod";
import { skrapa } from "../firecrawl";
import { struktur } from "../llm";
import type { Foretag } from "../types";

const Schema = z.object({
  namn: z.string(),
  vadNiSaljer: z.string(),
  malgrupp: z.string(),
  prismodell: z.string(),
  sprak: z.string(),
  geografi: z.string(),
  nyckelord: z.array(z.string()).min(2),
});

/** Step 01. Everything downstream is steered by this, so it reads the real site. */
export async function profileraSjalv(url: string): Promise<Foretag> {
  const sida = await skrapa(url);
  if (!sida) throw new Error(`Kunde inte läsa ${url}. Kontrollera adressen.`);

  const p = `Du läser ett företags egen webbplats och sammanfattar vad de gör.

# Sidan
URL: ${sida.url}
Titel: ${sida.titel}

${sida.markdown.slice(0, 12_000)}

# Uppgift
Fyll i fälten utifrån vad som FAKTISKT står på sidan. Gissa inte.
- "vadNiSaljer": en mening om vad de säljer.
- "malgrupp": vem som köper. Var konkret ("småföretagare i Sverige", inte "kunder").
- "prismodell": abonnemang, styckpris, offert — och prisnivå om den syns. Annars "framgår ej".
- "sprak": sajtens språk, t.ex. "svenska".
- "geografi": marknaden de verkar rikta sig till.
- "nyckelord": 2–6 söktermer man skulle använda för att hitta KONKURRENTER till dem.
  Använd samma språk som sajten. Skriv termer, inte meningar.

Svara med ENBART giltig JSON:
{"namn":"","vadNiSaljer":"","malgrupp":"","prismodell":"","sprak":"","geografi":"","nyckelord":[]}`;

  const ut = await struktur(p, Schema);
  return { ...ut, nyckelord: ut.nyckelord.slice(0, 6), url: sida.url };
}
