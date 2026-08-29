import { z } from "zod";
import { skrapa, sok } from "../firecrawl";
import { struktur } from "../llm";
import type { Orgdata } from "../types";

const Schema = z.object({
  orgnr: z.string().nullable(),
  omsattningTkr: z.number().nullable(),
  resultatTkr: z.number().nullable(),
  anstallda: z.number().nullable(),
  tillvaxtProcent: z.number().nullable(),
  ar: z.number().nullable(),
  citat: z.string().nullable(),
});

/**
 * The moat. Every Swedish AB files public annual accounts, so we can state a
 * competitor's revenue, headcount and growth — which no marketing page reveals
 * and no tool built for the US market goes looking for.
 */
export async function hamtaOrgdata(namn: string): Promise<Orgdata | null> {
  let traffar;
  try {
    traffar = await sok(`${namn} omsättning anställda bokslut`, { limit: 4 });
  } catch {
    return null;
  }

  const kandidat = traffar.find((t) =>
    /allabolag\.se|bolagsfakta\.se|ratsit\.se|proff\.se/.test(t.url),
  );
  if (!kandidat) return null;

  const sida = await skrapa(kandidat.url);
  if (!sida) return null;

  const p = `Du läser en svensk bolagsupplysningssida och plockar ut nyckeltalen.

# Sidan
${sida.url}

${sida.markdown.slice(0, 10_000)}

# Uppgift
Plocka ut siffrorna för ${namn}. Om sidan handlar om ett ANNAT bolag, sätt allt till null.
- Belopp i TUSENTALS kronor (tkr). Står det "4 236" i en tkr-kolumn är svaret 4236.
- "tillvaxtProcent": omsättningsförändring mot föregående år, om den framgår.
- "ar": vilket räkenskapsår siffrorna avser.
- "citat": den rad från sidan som siffrorna kommer ifrån, ordagrant. null om osäker.
Hitta ALDRIG på en siffra. null är ett korrekt svar.

Svara med ENBART giltig JSON:
{"orgnr":null,"omsattningTkr":null,"resultatTkr":null,"anstallda":null,"tillvaxtProcent":null,"ar":null,"citat":null}`;

  try {
    const ut = await struktur(p, Schema);
    if (ut.omsattningTkr === null && ut.anstallda === null) return null;
    const { citat, ...tal } = ut;
    return { ...tal, kalla: citat ? { url: sida.url, citat } : null };
  } catch {
    return null;
  }
}
