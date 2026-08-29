import { createHash } from "node:crypto";
import { parallellt, skrapa } from "../firecrawl";
import type { Forandring, Konkurrent, Rapport } from "../types";
import { arSvensk } from "./sprak";
import { bearbeta, bevakad, type HamtadSida } from "./undersok";

function hasha(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

/**
 * Keyed on the price, not the tier name. The name comes from a language model
 * and comes back worded differently every run — "Access 1-99 st" one time,
 * "Access 1-99 verifikationer" the next — so keying on it reports five changes
 * to a page where nothing moved. The number is what a customer cares about,
 * and it is stable.
 */
function normalisera(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/sek|kronor/g, "kr")
    .replace(/[.,](?=\d{3}\b)/g, "");
}

function prisrad(priser: Konkurrent["priser"]): Map<string, string> {
  return new Map(priser.map((p) => [normalisera(p.pris), p.namn]));
}

/**
 * The monitoring loop, and the reason the one-shot stores a hash per page.
 *
 * Re-reads exactly the pages it baselined — never re-runs page selection, which
 * could land on a different pricing page and report every tier as gone — and
 * only compares prices when the pricing page itself moved, because extraction
 * varies a little between runs and would otherwise invent changes.
 */
export async function koraKontroll(
  rapport: Rapport,
): Promise<{ forandringar: Forandring[]; rapport: Rapport; baslinjeAndrad: boolean }> {
  const svensk = arSvensk(rapport.egen);

  const resultat = await parallellt(rapport.konkurrenter, 4, async (k) => {
    const lasta = await parallellt(k.sidor, 2, async (s) => {
      const sida = await skrapa(s.url, { farsk: true });
      if (!sida) return null;
      return { bas: s, hamtad: { url: s.url, typ: s.typ, sida } as HamtadSida };
    });

    const levande = lasta.filter((x) => x !== null);
    const rorda = levande.filter((x) => hasha(x!.hamtad.sida.markdown) !== x!.bas.hash);
    const nu = new Date().toISOString();

    if (!rorda.length) {
      return { konkurrent: k, forandringar: [] as Forandring[], rord: false };
    }

    // Marketing pages churn — a rotating banner moves the hash daily. Say
    // nothing unless a price actually moved, but take the new baseline so the
    // next check does not re-read the same churn.
    const prissidanRordes = rorda.some((x) => x!.bas.typ === "pris");
    if (!prissidanRordes) {
      return {
        konkurrent: { ...k, sidor: levande.map((x) => bevakad(x!.hamtad)) },
        forandringar: [] as Forandring[],
        rord: true,
      };
    }

    const detaljer = await bearbeta(
      k.namn,
      k.url,
      levande.map((x) => x!.hamtad),
      svensk,
    );
    if (!detaljer) return { konkurrent: k, forandringar: [] as Forandring[], rord: true };

    const gamla = prisrad(k.priser);
    const nya = prisrad(detaljer.priser);
    const forandringar: Forandring[] = [];

    for (const [pris, namn] of nya) {
      if (!gamla.has(pris)) {
        forandringar.push({
          konkurrent: k.namn,
          url: k.url,
          typ: "pris",
          vad: `New price: ${namn} at ${pris}`,
          upptackt: nu,
        });
      }
    }

    for (const [pris, namn] of gamla) {
      if (!nya.has(pris)) {
        forandringar.push({
          konkurrent: k.namn,
          url: k.url,
          typ: "pris",
          vad: `Gone: ${namn} at ${pris}`,
          upptackt: nu,
        });
      }
    }

    // Feature lists are model-written prose and differ in wording every run, so
    // diffing them produces noise. If no price moved, this was churn: say nothing.

    return {
      konkurrent: {
        ...k,
        ...detaljer,
        sidor: levande.map((x) => bevakad(x!.hamtad)),
      },
      forandringar,
      rord: true,
    };
  });

  return {
    forandringar: resultat.flatMap((r) => r.forandringar),
    rapport: { ...rapport, konkurrenter: resultat.map((r) => r.konkurrent) },
    baslinjeAndrad: resultat.some((r) => r.rord),
  };
}
