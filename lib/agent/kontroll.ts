import { createHash } from "node:crypto";
import { parallellt, skrapa } from "../firecrawl";
import type { Forandring, Konkurrent, Rapport } from "../types";
import { undersokKonkurrent } from "./undersok";

function hasha(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

function prisrad(k: Konkurrent): Map<string, string> {
  return new Map(k.priser.map((p) => [p.namn.toLowerCase(), p.pris]));
}

/**
 * The monitoring loop, and the reason the one-shot stores a hash per page.
 * Re-reads only what we baselined, and only re-researches a competitor whose
 * pages actually moved — so a check costs a fraction of a full run.
 */
export async function koraKontroll(
  rapport: Rapport,
): Promise<{ forandringar: Forandring[]; rapport: Rapport }> {
  const svensk =
    /svensk/i.test(rapport.egen.sprak) || /sverige/i.test(rapport.egen.geografi);

  const resultat = await parallellt(rapport.konkurrenter, 5, async (k) => {
    const kontroller = await parallellt(k.sidor, 3, async (s) => {
      const sida = await skrapa(s.url);
      if (!sida) return null;
      return { sida: s, andrad: hasha(sida.markdown) !== s.hash };
    });

    const rorda = kontroller.filter((c) => c?.andrad).map((c) => c!.sida);
    if (!rorda.length) return { konkurrent: k, forandringar: [] as Forandring[] };

    // Something moved. Read it properly rather than guessing from a hash.
    const ny = await undersokKonkurrent(
      { namn: k.namn, url: k.url, varfor: k.varfor },
      k.hittadAv,
      svensk,
    ).catch(() => null);

    if (!ny) return { konkurrent: k, forandringar: [] as Forandring[] };

    const forandringar: Forandring[] = [];
    const gamla = prisrad(k);
    const nya = prisrad(ny);

    for (const [namn, pris] of nya) {
      const forr = gamla.get(namn);
      if (forr && forr !== pris) {
        forandringar.push({
          konkurrent: k.namn,
          url: k.url,
          typ: "pris",
          vad: `${namn} ändrades från ${forr} till ${pris}`,
          upptackt: new Date().toISOString(),
        });
      } else if (!forr) {
        forandringar.push({
          konkurrent: k.namn,
          url: k.url,
          typ: "pris",
          vad: `Ny prisnivå: ${namn} — ${pris}`,
          upptackt: new Date().toISOString(),
        });
      }
    }

    for (const [namn] of gamla) {
      if (!nya.has(namn)) {
        forandringar.push({
          konkurrent: k.namn,
          url: k.url,
          typ: "pris",
          vad: `Prisnivån ${namn} finns inte längre`,
          upptackt: new Date().toISOString(),
        });
      }
    }

    const nyaFunktioner = ny.funktioner.filter((f) => !k.funktioner.includes(f));
    for (const f of nyaFunktioner.slice(0, 2)) {
      forandringar.push({
        konkurrent: k.namn,
        url: k.url,
        typ: "produkt",
        vad: `Nytt på sajten: ${f}`,
        upptackt: new Date().toISOString(),
      });
    }

    if (!forandringar.length) {
      forandringar.push({
        konkurrent: k.namn,
        url: k.url,
        typ: rorda[0].typ,
        vad: `Sidan ändrades, men inte pris eller funktioner: ${rorda[0].url}`,
        upptackt: new Date().toISOString(),
      });
    }

    return { konkurrent: ny, forandringar };
  });

  return {
    forandringar: resultat.flatMap((r) => r.forandringar),
    rapport: { ...rapport, konkurrenter: resultat.map((r) => r.konkurrent) },
  };
}
