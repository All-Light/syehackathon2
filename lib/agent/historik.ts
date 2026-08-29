import { parallellt } from "../firecrawl";
import { hamtaArkiverad, hittaOgonblick } from "../wayback";
import type { Forandring, Konkurrent, Rapport } from "../types";
import { arSvensk } from "./sprak";
import { bearbeta, type HamtadSida } from "./undersok";

/** Keyed on the price, not the model-written tier name — same rule as kontroll. */
function normalisera(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "").replace(/sek|kronor/g, "kr");
}

function prisrad(priser: Konkurrent["priser"]): Map<string, string> {
  return new Map(priser.map((p) => [normalisera(p.pris), p.namn]));
}

/**
 * Read a competitor's pricing page as it stood on a past date, and turn the
 * differences between consecutive captures into dated change records.
 *
 * Only the pricing page: it is the page whose changes a customer can act on,
 * and every extra page multiplies both the archive fetches and the LLM calls.
 */
async function backaKonkurrent(
  k: Konkurrent,
  svensk: boolean,
  loggning?: (text: string) => void,
): Promise<Forandring[]> {
  const prissida = k.sidor.find((s) => s.typ === "pris");
  if (!prissida) return [];

  const ogonblick = await hittaOgonblick(prissida.url);
  if (!ogonblick.length) {
    loggning?.(`${k.namn}: nothing in the archive`);
    return [];
  }

  loggning?.(`${k.namn}: ${ogonblick.length} archived captures`);

  // Sequential: the archive is a public good and we are not entitled to hammer it.
  const lasta: { datum: string; arkivUrl: string; priser: Konkurrent["priser"] }[] = [];
  for (const o of ogonblick) {
    const text = await hamtaArkiverad(o.arkivUrl);
    if (!text) continue;

    const sida: HamtadSida = {
      url: prissida.url,
      typ: "pris",
      sida: { url: prissida.url, markdown: text, titel: `${k.namn} — ${o.datum}` },
    };
    const detaljer = await bearbeta(k.namn, k.url, [sida], svensk);
    if (!detaljer?.priser.length) continue;

    loggning?.(`${k.namn} on ${o.datum}: ${detaljer.priser.length} prices`);
    lasta.push({ datum: o.datum, arkivUrl: o.arkivUrl, priser: detaljer.priser });
  }

  if (!lasta.length) return [];

  // Compare each capture with the one before, then the last with today.
  const steg = [...lasta, { datum: "nu", arkivUrl: "", priser: k.priser }];
  const forandringar: Forandring[] = [];

  for (let i = 1; i < steg.length; i++) {
    const forr = prisrad(steg[i - 1].priser);
    const nu = prisrad(steg[i].priser);

    // A company changes one tier, or two. It does not delete five and write six.
    // When more prices differ than match, the likelier explanation by far is that
    // our extractor read two archived pages differently — Fortnox appeared to
    // drop all five tiers between 2 and 7 June and restore them in August, and
    // did no such thing. Silence beats a fabricated event history.
    const overlapp = [...nu.keys()].filter((p) => forr.has(p)).length;
    const skilda = forr.size + nu.size - 2 * overlapp;
    if (forr.size > 0 && nu.size > 0 && skilda > overlapp) {
      loggning?.(
        `${k.namn}: ${steg[i - 1].datum} vs ${steg[i].datum} — ${skilda} differ, ${overlapp} match, so this is a reading difference, not a repricing`,
      );
      continue;
    }
    const nar = steg[i].datum === "nu" ? new Date().toISOString() : `${steg[i].datum}T12:00:00Z`;
    const kalla = steg[i].arkivUrl || steg[i - 1].arkivUrl;
    // A change is only meaningful against a stated moment. "New price" alone
    // invites the reader to assume it appeared today; it appeared some time
    // after the date we are comparing against, and that date is knowable.
    const sedan = `since ${steg[i - 1].datum}`;

    for (const [pris, namn] of nu) {
      if (!forr.has(pris)) {
        forandringar.push({
          konkurrent: k.namn,
          url: k.url,
          typ: "pris",
          vad: `New price ${sedan}: ${namn} at ${pris}`,
          upptackt: nar,
          kalla,
          ursprung: "arkiv",
        });
      }
    }
    for (const [pris, namn] of forr) {
      if (!nu.has(pris)) {
        forandringar.push({
          konkurrent: k.namn,
          url: k.url,
          typ: "pris",
          vad: `Gone ${sedan}: ${namn} at ${pris}`,
          upptackt: nar,
          kalla,
          ursprung: "arkiv",
        });
      }
    }
  }

  return forandringar;
}

/**
 * History for a report that has none. Runs once — the archive does not change
 * retroactively, so there is nothing to gain from running it twice.
 */
export async function backaHistorik(
  rapport: Rapport,
  loggning?: (text: string) => void,
): Promise<Forandring[]> {
  const svensk = arSvensk(rapport.egen);
  const med = rapport.konkurrenter.filter((k) => k.sidor.some((s) => s.typ === "pris"));

  loggning?.(`Looking for archived captures of ${med.length} pricing pages`);

  const grupper = await parallellt(med, 2, (k) => backaKonkurrent(k, svensk, loggning));
  return grupper.flat().sort((a, b) => a.upptackt.localeCompare(b.upptackt));
}
