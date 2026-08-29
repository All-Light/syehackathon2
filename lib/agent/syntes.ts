import { z } from "zod";
import { struktur } from "../llm";
import type { Foretag, Konkurrent, Rapport } from "../types";

const Schema = z.object({
  sammanfattning: z.string(),
  hot: z
    .array(
      z.object({
        rubrik: z.string(),
        text: z.string(),
        konkurrent: z.string().nullable(),
        citat: z.string().nullable(),
        kallURL: z.string().nullable(),
      }),
    ),
  luckor: z
    .array(
      z.object({
        rubrik: z.string(),
        text: z.string(),
        konkurrent: z.string().nullable(),
        citat: z.string().nullable(),
        kallURL: z.string().nullable(),
      }),
    ),
  atgarder: z.array(z.string()).min(1),
});

function beskriv(k: Konkurrent): string {
  const priser = k.priser.length
    ? k.priser.map((p) => `${p.namn}: ${p.pris}${p.period ? ` / ${p.period}` : ""} [${p.kalla.url}]`).join("; ")
    : "inget publicerat pris";
  const org = k.orgdata
    ? `Omsättning ${k.orgdata.omsattningTkr ?? "?"} tkr (${k.orgdata.ar ?? "?"}), ` +
      `${k.orgdata.anstallda ?? "?"} anställda` +
      (k.orgdata.tillvaxtProcent !== null ? `, tillväxt ${k.orgdata.tillvaxtProcent} %` : "")
    : "inga offentliga bokslutssiffror hittade";

  return `## ${k.namn} (${k.url})
Positionering: ${k.positionering}
Målgrupp: ${k.malgrupp}
Priser: ${priser}
Funktioner: ${k.funktioner.join(", ") || "—"}
Styrkor: ${k.styrkor.join(", ") || "—"}
Svagheter: ${k.svagheter.join(", ") || "—"}
Bolagsdata: ${org}`;
}

/** Step 04. Judgment, not summary. Three actions, not fifteen observations. */
export async function syntetisera(
  egen: Foretag,
  konkurrenter: Konkurrent[],
): Promise<Rapport> {
  const p = `Du är en rådgivare som just gått igenom ett företags konkurrenter åt dem.
Du talar till ägaren. Var konkret, kort och ärlig. Skriv på svenska.

# Företaget du råder
${egen.namn} (${egen.url})
Säljer: ${egen.vadNiSaljer}
Till: ${egen.malgrupp}
Prismodell: ${egen.prismodell}
Marknad: ${egen.geografi}

# Konkurrenterna, lästa från deras egna sidor
${konkurrenter.map(beskriv).join("\n\n")}

# Uppgift
- "sammanfattning": EN mening, högst 100 tecken. Den visas som rubrik.
- "hot": där konkurrenterna är starkare. Högst 4.
- "luckor": där ${egen.namn} kan attackera — något ingen av dem gör, eller gör dåligt. Högst 4.
- "atgarder": exakt 3 saker att göra den här veckan. Konkreta och genomförbara för ett
  litet företag. Inte "se över er positionering" utan "sätt ut priset på startsidan —
  två av tre konkurrenter döljer sitt".
- "citat" och "kallURL": ordagrant citat och URL som stödjer påståendet, när ett finns
  i underlaget ovan. Annars null. Hitta ALDRIG på ett citat.

Svara med ENBART giltig JSON:
{"sammanfattning":"","hot":[{"rubrik":"","text":"","konkurrent":null,"citat":null,"kallURL":null}],"luckor":[{"rubrik":"","text":"","konkurrent":null,"citat":null,"kallURL":null}],"atgarder":[]}`;

  const ut = await struktur(p, Schema, { timeoutMs: 90_000 });
  const insikt = (i: z.infer<typeof Schema>["hot"][number]) => ({
    rubrik: i.rubrik,
    text: i.text,
    konkurrent: i.konkurrent,
    kalla: i.citat && i.kallURL ? { url: i.kallURL, citat: i.citat } : null,
  });

  return {
    sammanfattning: ut.sammanfattning,
    egen,
    konkurrenter,
    hot: ut.hot.slice(0, 4).map(insikt),
    luckor: ut.luckor.slice(0, 4).map(insikt),
    atgarder: ut.atgarder.slice(0, 3),
  };
}
