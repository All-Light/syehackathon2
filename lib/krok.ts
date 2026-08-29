import { belopp } from "./diagram";
import type { Konkurrent, Rapport } from "./types";

/**
 * The one thing a reader should take from the first second.
 *
 * A background cannot be a hook; a fact can. Each candidate below is computed
 * from stored evidence, so whichever wins is true — and they are tried in order
 * of how hard they land, not how easy they are to compute. If none can be
 * built, we say what we watch rather than inventing something arresting.
 */
export type Krok = {
  /** Rendered enormous. Short enough to read at a glance. */
  tal: string;
  /** The sentence around it. `tal` is not repeated here. */
  text: string;
  /** For the reader to check us. */
  kalla: string | null;
};

const filed = (k: Konkurrent) => k.orgdata?.omsattningTkr ?? null;

export function byggKrok(rapport: Rapport): Krok {
  const konkurrenter = rapport.konkurrenter;
  const egen = rapport.egen_djup;
  const namn = rapport.egen.namn;

  // 1. Size gap. The most physical fact we hold, and the one an owner feels.
  const storst = [...konkurrenter]
    .filter((k) => filed(k) !== null)
    .sort((a, b) => (filed(b) ?? 0) - (filed(a) ?? 0))[0];
  const vart = egen ? filed(egen) : null;
  if (storst && vart && vart > 0) {
    const gang = Math.round((filed(storst) ?? 0) / vart);
    if (gang >= 3) {
      return {
        tal: `${gang.toLocaleString("en-GB")}×`,
        text: `${storst.namn} is ${gang.toLocaleString("en-GB")} times your size by filed revenue. That is the shape of the field ${namn} is competing in.`,
        kalla: storst.orgdata?.kalla?.url ?? null,
      };
    }
  }

  // 2. How new the field is. A market being entered fast reads differently
  //    from a settled one, and nobody's marketing page says so.
  const iar = new Date().getFullYear();
  const unga = konkurrenter.filter(
    (k) => (k.orgdata?.registreringsar ?? 0) >= iar - 5,
  ).length;
  const medAr = konkurrenter.filter((k) => k.orgdata?.registreringsar).length;
  if (unga >= 2 && medAr >= 3) {
    return {
      tal: `${unga} of ${medAr}`,
      text: `of the competitors we could trace in the register were founded in the last five years. This market is being entered, not settled.`,
      kalla: null,
    };
  }

  // 3. Price opacity. Directly actionable, and true of most markets we read.
  const utanPris = konkurrenter.filter((k) => k.priser.length === 0).length;
  if (utanPris >= 2) {
    return {
      tal: `${utanPris} of ${konkurrenter.length}`,
      text: `competitors publish no price at all. Every one of them makes a buyer ask — and asking is where buyers leave.`,
      kalla: null,
    };
  }

  // 4. Growth of the fastest mover — but only where the base is material.
  //    A company going from 294 to 882 tkr is "+200%", which is arithmetically
  //    true and a lie as a headline: percentage growth on a near-zero base is
  //    noise, and putting it in the largest type on the page misleads the owner
  //    about who is actually coming for them.
  const VASENTLIGT_TKR = 5_000;
  const snabbast = [...konkurrenter]
    .filter(
      (k) =>
        (k.orgdata?.tillvaxtProcent ?? null) !== null &&
        (k.orgdata?.omsattningTkr ?? 0) >= VASENTLIGT_TKR,
    )
    .sort((a, b) => (b.orgdata!.tillvaxtProcent ?? 0) - (a.orgdata!.tillvaxtProcent ?? 0))[0];
  if (snabbast && (snabbast.orgdata!.tillvaxtProcent ?? 0) >= 10) {
    const p = snabbast.orgdata!.tillvaxtProcent!;
    const storlek = snabbast.orgdata!.omsattningTkr!;
    return {
      tal: `+${p}%`,
      text: `is what ${snabbast.namn} added in its last filed year, on ${belopp(storlek)}. Filed accounts, not a claim on a marketing page.`,
      kalla: snabbast.orgdata?.kalla?.url ?? null,
    };
  }

  // Nothing arresting is true. Say what we do instead of reaching.
  const sidor = konkurrenter.reduce((n, k) => n + k.sidor.length, 0);
  return {
    tal: String(konkurrenter.length),
    text: `competitors read from their own pages, across ${sidor} pages we now watch for changes.`,
    kalla: null,
  };
}
