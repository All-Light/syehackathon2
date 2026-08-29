import type { Bokslutsar } from "./types";

/**
 * The drawing grammar, shared by every exhibit in the product.
 *
 * These were private to components/Fullrapport.tsx and are now used by the
 * dashboard too. Extracted rather than copied: two exhibits that round their
 * axes differently, or truncate names differently, stop looking like one
 * report and start looking like two.
 */

export type Tillvaxtserie = { konkurrent: string; serie: Bokslutsar[] };

/** One filed year reduced to what a chart needs. */
export type Punkt = { ar: number; v: number };

export type Analys = {
  namn: string;
  rader: Bokslutsar[];
  punkter: Punkt[];
  /** Per year, not total, so competitors with different spans can be compared. */
  arligt: number | null;
  /** Over that competitor's own span. Lives in the table, where the span is stated. */
  totalt: number | null;
};

export function datum(skapad: string) {
  const d = new Date(skapad);
  // Rendered on the server too, so no locale formatting that could differ there.
  return Number.isNaN(d.getTime()) ? skapad : d.toISOString().slice(0, 10);
}

export function snyggtSteg(v: number) {
  if (!(v > 0)) return 1;
  const tiopotens = 10 ** Math.floor(Math.log10(v));
  const n = v / tiopotens;
  const s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return s * tiopotens;
}

export function kort(s: string, n = 18) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function tal(v: number) {
  const n = Math.abs(v);
  const decimaler = n === 0 || n >= 10 ? 1 : n >= 1 ? 2 : 3;
  return v.toLocaleString("en-GB", { maximumFractionDigits: decimaler });
}

/** tkr is unreadable at a billion, so the number picks its own unit. */
export function belopp(tkr: number) {
  const msek = tkr / 1000;
  if (Math.abs(msek) >= 1000) return `${(msek / 1000).toFixed(2)} bn SEK`;
  if (Math.abs(msek) >= 100) return `${tal(Math.round(msek))} MSEK`;
  // Below a million kronor, MSEK stops being readable — say it in tkr.
  if (Math.abs(msek) < 1) return `${tal(tkr)} tkr`;
  return `${tal(msek)} MSEK`;
}

export function procent(v: number) {
  const n = Math.abs(v);
  // A tenth of a percent is noise once the change is in the hundreds.
  return `${v >= 0 ? "+" : "−"}${tal(n >= 100 ? Math.round(n) : n)}%`;
}

/** Push labels apart so no two overlap, then keep the column inside the plot. */
export function utanKrock<T extends { y: number }>(punkter: T[], ovre: number, undre: number) {
  const sorterade = [...punkter].sort((a, b) => a.y - b.y);
  let forra = -Infinity;
  const placerade = sorterade.map((p) => {
    const ey = Math.max(p.y, forra + 15);
    forra = ey;
    return { ...p, ey };
  });
  const overskott = forra - undre;
  if (overskott > 0) {
    const skift = Math.min(overskott, (placerade[0]?.ey ?? ovre) - ovre);
    return placerade.map((p) => ({ ...p, ey: p.ey - skift }));
  }
  return placerade;
}

/** The register hands us newest first; a chart reads left to right. */
export function kronologisk(serie: Bokslutsar[]) {
  return [...serie].sort((a, b) => a.ar - b.ar);
}

/**
 * Unbroken runs of filed revenue. A null year — or a year simply missing from
 * the filing list — ends the run rather than being bridged, because a straight
 * line through a gap claims a number nobody filed.
 */
export function segment(rader: Bokslutsar[]) {
  const ut: Punkt[][] = [];
  let nu: Punkt[] = [];
  for (const r of rader) {
    const forra = nu[nu.length - 1];
    if (r.omsattningTkr === null || (forra && r.ar !== forra.ar + 1)) {
      if (nu.length) ut.push(nu);
      nu = [];
    }
    if (r.omsattningTkr !== null) nu.push({ ar: r.ar, v: r.omsattningTkr });
  }
  if (nu.length) ut.push(nu);
  return ut;
}

/** Only holes inside a company's own filed span count — years before it filed are not gaps. */
export function luckor(rader: Bokslutsar[], forsta: number, sista: number) {
  const ut: number[] = [];
  for (let ar = forsta + 1; ar < sista; ar++) {
    const rad = rader.find((r) => r.ar === ar);
    if (!rad || rad.omsattningTkr === null) ut.push(ar);
  }
  return ut;
}

export function analysera(s: Tillvaxtserie): Analys {
  const rader = kronologisk(s.serie);
  const punkter = rader
    .filter((r): r is Bokslutsar & { omsattningTkr: number } => r.omsattningTkr !== null)
    .map((r) => ({ ar: r.ar, v: r.omsattningTkr }));
  const forsta = punkter[0];
  const sista = punkter[punkter.length - 1];
  const matbart = !!forsta && !!sista && forsta.v > 0 && sista.ar > forsta.ar;
  return {
    namn: s.konkurrent,
    rader,
    punkter,
    arligt: matbart
      ? ((sista.v / forsta.v) ** (1 / (sista.ar - forsta.ar)) - 1) * 100
      : null,
    totalt: matbart ? (sista.v / forsta.v - 1) * 100 : null,
  };
}
