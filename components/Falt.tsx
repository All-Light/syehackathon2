"use client";

import { useState, type CSSProperties } from "react";
import {
  analysera,
  belopp,
  kort,
  luckor,
  procent,
  segment,
  tal,
  utanKrock,
  type Analys,
  type Punkt,
  type Tillvaxtserie,
} from "@/lib/diagram";

/**
 * The field — every company that files, on one chart.
 *
 * The report draws filed revenue as small multiples, one panel per competitor,
 * because the money itself is the point there. The dashboard asks a different
 * question: who is pulling away. That needs one chart, and one chart cannot
 * carry a 1.8 bn SEK incumbent and a 900 tkr one-person shop on a shared money
 * axis — the second is a flat line on the floor and the reader learns nothing.
 *
 * So two decisions, and they only work together:
 *
 * 1. Index. Every series is 100 at its own first filed year and the line is the
 *    multiple since. Absolute size does not vanish; it moves to the direct label
 *    and to the table underneath.
 *
 * 2. A ratio (log) axis for that index. Indexing alone is not enough: a company
 *    whose first filed year was 49 tkr reaches 1,800, while an incumbent
 *    genuinely tripling from 640 MSEK reaches 280 — and on a linear axis that
 *    incumbent is squashed into the bottom eighth and reads as flat, which is
 *    the same failure the index was meant to fix, one level up. On a ratio scale
 *    a doubling is the same rise wherever it happens, so equal slopes mean equal
 *    growth, which is precisely the comparison this exhibit exists to make.
 */

export type Faltprops = {
  /** One per competitor that files. Newest first; up to five filed years, tkr. */
  konkurrenter: Tillvaxtserie[];
  /**
   * The reader's own company, read the same way. Drawn last, in the second hue,
   * because "which line is me" is the only question they arrive with.
   */
  egen?: Tillvaxtserie | null;
  /** The customer's own name, which is what the own line is labelled with. */
  egetNamn?: string;
};

/* ---------------------------------------------------------------------------
   Structure. --linje is the product's gridline everywhere and stays it here.
   The two marks that must out-rank it are mixed from --dampad rather than given
   new tokens: a missing year has to be louder than a year that is merely there,
   and the 100 line is the reference the whole chart is read against.

   Both mixes are of --dampad, so both invert with the ground and the ranking
   survives the switch. The baseline was 50% on paper; on the night card that
   landed at 2.4:1, under the floor for a mark the whole chart is read against,
   so it is 62% now — 3.19:1 there, and still recessive on paper.
   --------------------------------------------------------------------------- */
const HAL = "color-mix(in oklab, var(--dampad) 35%, transparent)";
const BAS = "color-mix(in oklab, var(--dampad) 62%, transparent)";

/* ---------------------------------------------------------------------------
   Ticks on a ratio scale. snyggtSteg() picks a constant step, and a constant
   step is meaningless here — the gap from 100 to 200 must be the gap from 1,000
   to 2,000. Same 1 / 2 / 5 × power-of-ten family, used as positions instead.
   --------------------------------------------------------------------------- */
function nedat(v: number) {
  const p = Math.floor(Math.log10(v));
  const n = v / 10 ** p;
  return (n >= 5 ? 5 : n >= 2 ? 2 : 1) * 10 ** p;
}

function uppat(v: number) {
  const p = Math.floor(Math.log10(v));
  const n = v / 10 ** p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * 10 ** p;
}

function stopp(lag: number, hog: number) {
  const ut: number[] = [];
  for (let p = Math.floor(Math.log10(lag)); p <= Math.ceil(Math.log10(hog)); p++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** p;
      if (v >= lag * 0.999 && v <= hog * 1.001) ut.push(v);
    }
  }
  return ut;
}

/** One company's line, ready to draw: the money, the index, and the holes. */
type Rad = {
  id: string;
  analys: Analys;
  egen: boolean;
  /** First filed revenue. Every index on this row is relative to it. */
  bas: number | null;
  /** Indexed points, chronological. Empty when there is no usable base. */
  indexerade: Punkt[];
  /** Unbroken runs, already indexed. A gap ends a run; nothing is bridged. */
  bitar: Punkt[][];
  /** Years missing strictly inside this company's own filed span. */
  hal: number[];
};

function bygg(s: Tillvaxtserie, egen: boolean, namn?: string): Rad {
  // The own series arrives with whatever key the report filed it under; the
  // reader knows their company by its name, so the caller's name wins.
  const grund = analysera(s);
  const analys = { ...grund, namn: namn?.trim() || grund.namn };
  const forsta = analys.punkter[0];
  const sist = analys.punkter[analys.punkter.length - 1];
  // A base of zero or less cannot be indexed — the ratio is undefined or flips
  // sign. Such a row keeps its money in the table and stays off the chart.
  const bas = forsta && forsta.v > 0 ? forsta.v : null;
  const om = (p: Punkt) => ({ ar: p.ar, v: (p.v / (bas as number)) * 100 });

  // segment() already splits on a null year and on a year gap. A filed zero is a
  // third kind of hole, and one that only exists on a ratio scale: zero is
  // infinitely far down one, so it cannot be placed. It breaks the run exactly
  // like a missing year rather than being nudged onto a value nobody filed.
  const bitar: Punkt[][] = [];
  for (const bit of bas === null ? [] : segment(analys.rader)) {
    let nu: Punkt[] = [];
    for (const p of bit) {
      if (p.v > 0) nu.push(om(p));
      else if (nu.length) {
        bitar.push(nu);
        nu = [];
      }
    }
    if (nu.length) bitar.push(nu);
  }

  return {
    id: `${egen ? "du" : "k"}:${analys.namn}`,
    analys,
    egen,
    bas,
    indexerade: bas === null ? [] : analys.punkter.filter((p) => p.v > 0).map(om),
    bitar,
    hal: forsta && sist ? luckor(analys.rader, forsta.ar, sist.ar) : [],
  };
}

/** Length of a polyline in viewBox units — getTotalLength() has no server. */
function banlangd(punkter: { x: number; y: number }[]) {
  let summa = 0;
  for (let i = 1; i < punkter.length; i++) {
    summa += Math.hypot(punkter[i].x - punkter[i - 1].x, punkter[i].y - punkter[i - 1].y);
  }
  return summa;
}

/** Per-path stroke length and stagger. The reader's own line draws last. */
function dragstil(langd: number, ordning: number): CSSProperties {
  return { "--langd": langd, animationDelay: `${ordning * 90}ms` } as CSSProperties;
}

/* ------------------------------------------------------------------------- */

function Falttabell({
  rader,
  ar,
  hovrad,
  sattHovrad,
}: {
  rader: Rad[];
  ar: number[];
  hovrad: string | null;
  sattHovrad: (id: string | null) => void;
}) {
  function cell(v: number | null) {
    return v === null ? (
      <span className="text-dampad">—</span>
    ) : (
      <span className="data text-black">{tal(v)}</span>
    );
  }

  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">
          Filed annual revenue in thousands of SEK, and the same figures indexed to 100
          at each company&rsquo;s own first filed year. An em dash means no figure was
          filed for that year.
        </caption>
        <thead>
          <tr className="border-b border-linje text-[10px] uppercase tracking-[0.12em] text-dampad">
            <th className="py-2 pr-3 font-normal">Company</th>
            <th className="py-2 pr-3 font-normal">Figure</th>
            {ar.map((a) => (
              <th key={a} className="data py-2 pl-3 text-right font-normal">
                {a}
              </th>
            ))}
            <th className="py-2 pl-3 text-right font-normal">Change over span</th>
          </tr>
        </thead>
        <tbody>
          {rader.map((r) => {
            const markerad = hovrad === r.id;
            const rita = (typ: "tkr" | "index") => (
              <tr
                key={`${r.id}-${typ}`}
                onMouseEnter={() => sattHovrad(r.id)}
                onMouseLeave={() => sattHovrad(null)}
                className={`${typ === "index" ? "border-b border-linje" : ""} ${
                  markerad ? "bg-upphojd" : ""
                }`}
              >
                {typ === "tkr" ? (
                  <td
                    rowSpan={2}
                    className={`py-2 pr-3 align-top ${r.egen ? "text-du" : "text-black"}`}
                  >
                    {r.analys.namn}
                    {r.egen ? (
                      <span className="ml-1.5 align-[0.1em] text-[10px] uppercase tracking-[0.12em] text-du">
                        You
                      </span>
                    ) : null}
                  </td>
                ) : null}
                <td className="whitespace-nowrap py-2 pr-3 text-dampad">
                  {typ === "tkr" ? "Revenue, tkr" : "Index"}
                </td>
                {ar.map((y) => {
                  const bok = r.analys.rader.find((x) => x.ar === y);
                  const v = bok ? bok.omsattningTkr : null;
                  if (typ === "tkr") {
                    return (
                      <td key={y} className="py-2 pl-3 text-right">
                        {cell(v)}
                      </td>
                    );
                  }
                  // The index row is the plotted value, so it is the row that makes
                  // the drawing checkable rather than merely illustrated.
                  const i = v !== null && r.bas !== null ? (v / r.bas) * 100 : null;
                  return (
                    <td key={y} className="py-2 pl-3 text-right">
                      {cell(i)}
                    </td>
                  );
                })}
                <td className="py-2 pl-3 text-right">
                  {typ === "tkr" && r.analys.totalt !== null ? (
                    <span className="data text-black">{procent(r.analys.totalt)}</span>
                  ) : (
                    <span className="text-dampad">—</span>
                  )}
                </td>
              </tr>
            );
            return [rita("tkr"), rita("index")];
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

export default function Falt({ konkurrenter, egen = null, egetNamn }: Faltprops) {
  const [hovrad, sattHovrad] = useState<string | null>(null);

  const rader = [
    ...konkurrenter.map((s) => bygg(s, false)),
    ...(egen ? [bygg(egen, true, egetNamn)] : []),
  ].filter((r) => r.analys.rader.length > 0);

  // Nothing filed anywhere. An empty axis would claim we looked and found zero;
  // the honest reading is that this market does not file here at all.
  if (!rader.length) {
    return (
      <figure className="tryck-hel m-0 flex flex-col gap-4">
        <p className="text-[15px] leading-relaxed text-dampad">
          Not one company in this set files annual accounts in Sweden, so there is no
          field to plot. That is a finding rather than a blank: filed accounts exist only
          for Swedish aktiebolag, and a foreign parent, a branch, a partnership or a sole
          trader files nothing here — which is not the same thing as being small.
        </p>
      </figure>
    );
  }

  // Table columns cover every filed year on record, including years belonging to
  // rows the chart cannot draw.
  const arSet = new Set<number>();
  for (const r of rader) for (const b of r.analys.rader) arSet.add(b.ar);
  const ar = [...arSet].sort((a, b) => a - b);

  // The right edge of the chart is a ranking, so the table is ordered to mirror
  // it: whoever ends highest against their own starting point comes first.
  const sorterade = [...rader].sort(
    (a, b) =>
      (b.indexerade[b.indexerade.length - 1]?.v ?? -Infinity) -
      (a.indexerade[a.indexerade.length - 1]?.v ?? -Infinity),
  );

  const ritbara = sorterade.filter((r) => r.indexerade.length > 0);
  const medLinje = ritbara.filter((r) => r.indexerade.length >= 2);
  // Paint order is recessive to dominant all the way down: competitors, then the
  // reader's own line on top of them.
  const ritordning = [...ritbara.filter((r) => !r.egen), ...ritbara.filter((r) => r.egen)];

  // The viewBox is sized to the band it renders in — now the inside of a console
  // card in an 880px column, so about 792px — rather than picked round: at 1:1 a
  // 13px label is 13px on screen, and every type size in this exhibit matches the
  // ones in the report. The right margin stays 154 units, which is the label
  // column; only the plot got the extra width.
  const B = 792;
  const H = 442;
  const x0 = 46;
  const x1 = 638;
  const y1 = 58;
  const y0 = 374;

  const arRit = [...new Set(ritbara.flatMap((r) => r.indexerade.map((p) => p.ar)))].sort(
    (a, b) => a - b,
  );
  const minAr = arRit[0] ?? ar[0];
  const maxAr = arRit[arRit.length - 1] ?? ar[ar.length - 1];
  const spann = Math.max(maxAr - minAr, 1);
  const xAv = (a: number) => x0 + ((a - minAr) / spann) * (x1 - x0);

  const varden = ritbara.flatMap((r) => r.indexerade.map((p) => p.v));
  // 100 is always in range: it is the reference the whole chart is read against.
  // A ratio scale has no zero to start at, so the floor is the nearest round
  // multiple below the weakest line instead — and the axis caption says so.
  const golv = Math.min(nedat(Math.min(100, ...varden)), 100);
  const tak = Math.max(uppat(Math.max(100, ...varden)), golv * 2);
  const lgGolv = Math.log10(golv);
  const lgTak = Math.log10(tak);
  const yAv = (v: number) => y0 - ((Math.log10(v) - lgGolv) / (lgTak - lgGolv)) * (y0 - y1);

  const yTickar = stopp(golv, tak);
  const yBas = yAv(100);

  // One rule per year that is a hole for somebody. Dashed, and a shade louder
  // than the grid, so it reads as "a filing is missing here" rather than as
  // another year marker — and it is drawn where a line is not, never across one.
  const halAr = [...new Set(ritbara.flatMap((r) => r.hal))].sort((a, b) => a - b);

  // A label is two lines — the name, and the money the index threw away — so it
  // needs about 25px of clearance where utanKrock guarantees 15. Rather than
  // reimplement the de-collider, the y axis is compressed into its units and the
  // answer expanded back out: 15 units of its spacing become RADHOJD of ours.
  const RADHOJD = 25;
  const k = RADHOJD / 15;
  // Every label stands in one column in the right margin rather than beside its
  // own last point. Anchoring each to its own endpoint is what the map does, but
  // there the dots are spread over the whole width; here several lines can end in
  // the same year at nearly the same height and the labels pile up on the year
  // axis. One column, leaders back to the points.
  const etikettX = x1 + 16;
  const etiketter = utanKrock(
    ritbara.map((r) => {
      const sist = r.indexerade[r.indexerade.length - 1];
      return { r, x: xAv(sist.ar), y: yAv(sist.v) / k, yPunkt: yAv(sist.v) };
    }),
    (y1 - 30) / k,
    y0 / k,
  ).map((e) => ({ ...e, ey: e.ey * k }));

  return (
    <figure className="tryck-hel m-0 flex flex-col gap-6">
      {medLinje.length > 0 ? (
        // The table below carries every value, so the drawing is hidden from a screen
        // reader rather than read out as a second, worse copy of the same data.
        // Below about 700px a viewBox this wide scales its 12px ticks down to
        // single figures, so the drawing scrolls at a legible size rather than
        // shrinking into one. Print still gets the whole width on the page.
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 print:overflow-visible">
          <svg
            viewBox={`0 0 ${B} ${H}`}
            width="100%"
            aria-hidden="true"
            className="h-auto w-full min-w-[640px] overflow-visible print:min-w-0"
          >
            {/* Recessive first: grid, then the axis, then the data over both. */}
            {arRit.map((a) =>
              halAr.includes(a) ? null : (
                <line
                  key={`rutnat-${a}`}
                  x1={xAv(a)}
                  y1={y1 - 8}
                  x2={xAv(a)}
                  y2={y0}
                  stroke="var(--linje)"
                  strokeWidth="1"
                />
              ),
            )}
            {halAr.map((a) => (
              <line
                key={`hal-${a}`}
                x1={xAv(a)}
                y1={y1 - 8}
                x2={xAv(a)}
                y2={y0}
                stroke={HAL}
                strokeWidth="1"
                strokeDasharray="2 5"
              />
            ))}

            {/* The one baseline: 100 is where every company starts, so it is the
                line the whole chart is read against — not the bottom of the box. */}
            <line x1={x0} y1={yBas} x2={x1} y2={yBas} stroke={BAS} strokeWidth="1" />

            {yTickar.map((v) =>
              // A tick sitting on top of the 100 label would print the reference twice.
              Math.abs(yAv(v) - yBas) < 12 ? null : (
                <text
                  key={`ytick-${v}`}
                  x={x0 - 10}
                  y={yAv(v) + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill="var(--dampad)"
                  className="data"
                >
                  {tal(v)}
                </text>
              ),
            )}
            <text
              x={x0 - 10}
              y={yBas + 4}
              textAnchor="end"
              fontSize="12"
              fill="var(--black)"
              className="data"
            >
              100
            </text>

            {arRit.map((a) => (
              <text
                key={`artick-${a}`}
                x={xAv(a)}
                y={y0 + 22}
                textAnchor="middle"
                fontSize="12"
                fill="var(--dampad)"
                className="data"
              >
                {a}
              </text>
            ))}
            <text
              x={(x0 + x1) / 2}
              y={y0 + 46}
              textAnchor="middle"
              fontSize="11"
              letterSpacing="1.6"
              fill="var(--dampad)"
            >
              FILED FINANCIAL YEAR
            </text>

            {/* Said on the axis, not only in the caption. A reader can get two things
                wrong here — that the numbers are kronor, and that the spacing up the
                side is even — so both are answered before the first line is looked at,
                in words an owner rather than an analyst would use. */}
            <text x={0} y={y1 - 38} fontSize="11" letterSpacing="1.6" fill="var(--dampad)">
              INDEX — EACH COMPANY&rsquo;S OWN FIRST FILED YEAR = 100
            </text>
            <text x={0} y={y1 - 20} fontSize="11.5" fill="var(--dampad)">
              {`Equal slopes mean equal growth: a doubling is the same height anywhere. Starts at ${tal(golv)}, not zero.`}
            </text>

            {ritordning.map((r, n) => {
              const aktiv = hovrad === r.id;
              const fardg = r.egen ? "var(--du)" : "var(--amber)";
              const tjocklek = r.egen ? 2.75 : 2;
              const sist = r.indexerade[r.indexerade.length - 1];
              const pengar = r.analys.punkter[r.analys.punkter.length - 1];
              return (
                <g
                  key={r.id}
                  onMouseEnter={() => sattHovrad(r.id)}
                  onMouseLeave={() => sattHovrad(null)}
                  // Dimming the rest is the cheapest way to follow one line out of six.
                  style={{
                    opacity: hovrad === null || aktiv ? 1 : 0.3,
                    transition: "opacity 160ms ease",
                  }}
                >
                  <title>
                    {`${r.analys.namn} — ${belopp(pengar.v)} in ${pengar.ar}, index ${tal(sist.v)}`}
                  </title>
                  {r.bitar.map((bit, i) => {
                    if (bit.length < 2) return null;
                    const koord = bit.map((p) => ({ x: xAv(p.ar), y: yAv(p.v) }));
                    const punkter = koord.map((p) => `${p.x},${p.y}`).join(" ");
                    return (
                      <g key={`bit-${i}`}>
                        <polyline
                          className="drag"
                          points={punkter}
                          fill="none"
                          stroke={fardg}
                          strokeWidth={aktiv ? tjocklek + 1 : tjocklek}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          style={dragstil(banlangd(koord), n)}
                        />
                        {/* A 2px line is not a hover target. */}
                        <polyline
                          points={punkter}
                          fill="none"
                          stroke="transparent"
                          strokeWidth="20"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      </g>
                    );
                  })}
                  {r.indexerade.map((p, i) => {
                    const slut = i === r.indexerade.length - 1;
                    // A single filed year has no line, so the dot is the whole record
                    // of it and must survive on its own.
                    const ensam = r.indexerade.length === 1;
                    return (
                      <circle
                        key={`p-${p.ar}`}
                        cx={xAv(p.ar)}
                        cy={yAv(p.v)}
                        r={slut ? (aktiv ? 5.5 : ensam ? 5 : 4.5) : 2.5}
                        fill={fardg}
                        stroke={slut ? "var(--halo)" : "none"}
                        strokeWidth={slut ? 2 : 0}
                      />
                    );
                  })}
                </g>
              );
            })}

            {etiketter.map(({ r, x, yPunkt, ey }) => {
              const aktiv = hovrad === r.id;
              const pengar = r.analys.punkter[r.analys.punkter.length - 1];
              const namn = kort(r.analys.namn);
              const summa = belopp(pengar.v);
              // Rough advance widths at 13px and 11px. kort() truncates by character
              // count, so a name of wide glyphs can still outrun the margin; then the
              // label turns back over the plot rather than off the edge of the figure.
              const bredd = Math.max(namn.length * 6.9, summa.length * 5.8);
              const vand = etikettX + bredd > B - 4;
              const ex = vand ? x1 - 8 : etikettX;
              // A leader wherever the label is not already sitting on its point —
              // nudged off it vertically, or standing right of a line that stopped
              // filing early.
              const leder = Math.abs(ey - yPunkt) > 4 || x < x1 - 6;
              return (
                <g
                  key={`etikett-${r.id}`}
                  onMouseEnter={() => sattHovrad(r.id)}
                  onMouseLeave={() => sattHovrad(null)}
                  style={{
                    opacity: hovrad === null || aktiv ? 1 : 0.3,
                    transition: "opacity 160ms ease",
                  }}
                >
                  {leder && !vand && (
                    <polyline
                      points={`${x + 8},${yPunkt} ${ex - 6},${yPunkt} ${ex - 6},${ey - 4}`}
                      fill="none"
                      stroke="var(--linje)"
                      strokeWidth="1"
                    />
                  )}
                  <text
                    x={ex}
                    y={ey}
                    textAnchor={vand ? "end" : "start"}
                    fontSize="13"
                    fill={r.egen ? "var(--du)" : "var(--black)"}
                    fontWeight={r.egen || aktiv ? 600 : 400}
                  >
                    {namn}
                  </text>
                  {/* Indexing throws absolute size away; the second line hands it back. */}
                  <text
                    x={ex}
                    y={ey + 15}
                    textAnchor={vand ? "end" : "start"}
                    fontSize="11"
                    fill="var(--dampad)"
                    className="data"
                  >
                    {summa}
                  </text>
                  <rect
                    x={vand ? ex - bredd - 6 : ex - 6}
                    y={ey - 14}
                    width={bredd + 12}
                    height={33}
                    fill="transparent"
                  />
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        // An empty frame would imply we drew something. Say the thing instead.
        <p className="text-[15px] leading-relaxed text-dampad">
          Every company here that files has only a single readable year, so no trajectory
          can be drawn — one point is a position, not a direction. The filed figures are
          below.
        </p>
      )}

      <Falttabell rader={sorterade} ar={ar} hovrad={hovrad} sattHovrad={sattHovrad} />

      <figcaption className="text-[13px] leading-relaxed text-dampad">
        {medLinje.length > 0 && (
          <>
            <strong className="font-medium text-black">
              The vertical axis is an index, not kronor.
            </strong>{" "}
            Every company is set to 100 in its own first filed year, and its line is the
            multiple of that year since — so 200 is twice the revenue it started this
            chart with, whether that start was 49 tkr or 640 MSEK. The axis is a{" "}
            <strong className="font-medium text-black">ratio scale</strong>: the climb
            from 100 to 200 is exactly as tall as the climb from 1,000 to 2,000, so two
            lines rising at the same angle are growing at the same rate however far apart
            they sit on the page. That is what lets a 1.8 bn SEK incumbent and a
            one-person shop be compared at all. A ratio scale has no zero to start from,
            so the axis starts at {tal(golv)} instead. Absolute size has not been thrown
            away — it is in the label at the end of every line and in every cell of the
            table. Each company is measured against its own first filed year and those
            years differ, so read these lines as how fast each has grown since it began
            filing, not as who is bigger.{" "}
            {egen ? "Your own company is the green line. " : ""}
          </>
        )}
        Figures are filed annual accounts from the Swedish company register, oldest year
        on the left. Accounts are filed in arrears and lag by up to a year, so the most
        recent year may be missing.{" "}
        {medLinje.length > 0 && (
          <>
            A year with no filed figure breaks the line and is marked by a faint dashed
            rule; nothing is interpolated across the gap, and a filed zero breaks it the
            same way, having no place on a ratio scale.{" "}
          </>
        )}
        These figures exist only for Swedish aktiebolag — a competitor absent from this
        exhibit files nothing here, which is not the same thing as being small.
      </figcaption>
    </figure>
  );
}
