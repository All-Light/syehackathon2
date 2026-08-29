"use client";

import { useEffect, useRef, useState } from "react";
import Swotvy from "@/components/Swot";
import { Svep } from "@/components/Arbetsvy";
// Aliased because the component below owns the name `Fullrapport` in this module.
import type {
  Avsnitt,
  Bokslutsar,
  Fullrapport as Fulldata,
  FullHandelse,
  Kalla,
  Position,
  Tillit,
} from "@/lib/types";

/**
 * The paid deliverable. A strategy report is read in one order — the answer, then
 * the four things that make it true, then the arguments, then the evidence — so
 * that is the order it is typeset in, on screen and on paper alike.
 */

const TILLITSTEXT: Record<Tillit, string> = {
  verifierat: "Verified",
  harlett: "Derived",
  bedomning: "Judgement",
};

/** The rule behind each label, so the chip is checkable rather than decorative. */
const TILLITSREGEL: Record<Tillit, string> = {
  verifierat: "Quoted from a page we fetched, or from a public filing.",
  harlett: "Follows from two or more verified facts.",
  bedomning: "Our reading. A reasonable person could disagree.",
};

/**
 * Solidity carries confidence: filled, hairline, dashed. Deliberately not a
 * red-amber-green scale — these are distances from a source, not severities.
 */
const TILLITSSTIL: Record<Tillit, string> = {
  verifierat: "border-black/20 bg-black/5 text-black",
  harlett: "border-linje text-dampad",
  bedomning: "border-dashed border-linje text-dampad",
};

function datum(skapad: string) {
  const d = new Date(skapad);
  // Rendered on the server too, so no locale formatting that could differ there.
  return Number.isNaN(d.getTime()) ? skapad : d.toISOString().slice(0, 10);
}

function Tillitsmarke({ tillit }: { tillit: Tillit }) {
  return (
    <span
      title={TILLITSREGEL[tillit]}
      className={`shrink-0 border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${TILLITSSTIL[tillit]}`}
    >
      {TILLITSTEXT[tillit]}
    </span>
  );
}

/**
 * Same disclosure as the free report: hidden behind a press on screen, forced
 * open in print by `.kalla-text`, because a folded source is no source at all on
 * paper.
 */
function Kallhanvisning({ kallor }: { kallor: Kalla[] }) {
  const [oppen, satt] = useState(false);
  if (!kallor?.length) return null;
  return (
    <span className="inline-flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => satt((o) => !o)}
        className="ej-tryck self-start text-[11px] uppercase tracking-[0.12em] text-amber underline-offset-4 hover:underline"
        aria-expanded={oppen}
      >
        {oppen
          ? "Hide sources"
          : kallor.length === 1
            ? "Show source"
            : `Show sources (${kallor.length})`}
      </button>
      <span
        className={`kalla-text border-l-2 border-linje pl-3 text-sm text-dampad ${
          oppen ? "block" : "hidden"
        }`}
      >
        {kallor.map((k, n) => (
          <span key={`${k.url}-${n}`} className={`block ${n > 0 ? "mt-3" : ""}`}>
            <span className="block italic">&ldquo;{k.citat}&rdquo;</span>
            <a
              href={k.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block break-all text-xs text-amber underline-offset-4 hover:underline"
            >
              {k.url}
            </a>
          </span>
        ))}
      </span>
    </span>
  );
}

/** One argument. The heading is the claim; the body is why it holds. */
function Avsnittsvy({ avsnitt, nummer }: { avsnitt: Avsnitt; nummer: number }) {
  return (
    <article className="tryck-hel flex flex-col gap-3">
      <div className="flex items-baseline gap-4">
        <span className="siffror shrink-0 text-sm text-amber">
          {String(nummer).padStart(2, "0")}
        </span>
        <h3 className="font-serif text-2xl leading-[1.2] text-black sm:text-[28px]">
          {avsnitt.rubrik}
        </h3>
      </div>
      <div className="flex flex-col gap-3 sm:pl-9">
        <p className="text-[15px] leading-[1.75] whitespace-pre-line text-black">
          {avsnitt.brodtext}
        </p>
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <Tillitsmarke tillit={avsnitt.tillit} />
          <Kallhanvisning kallor={avsnitt.kallor} />
        </div>
      </div>
    </article>
  );
}

/* ---------------------------------------------------------------------------
   The map: price against breadth. One series, so every dot is the same amber and
   carries its own name — identity never rests on colour. Nobody who publishes no
   price is plotted at zero; they get their own lane, because "free" and "you have
   to ask" are different facts.
   --------------------------------------------------------------------------- */

function snyggtSteg(v: number) {
  if (!(v > 0)) return 1;
  const tiopotens = 10 ** Math.floor(Math.log10(v));
  const n = v / tiopotens;
  const s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return s * tiopotens;
}

function kort(s: string, n = 18) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function tal(v: number) {
  const n = Math.abs(v);
  const decimaler = n === 0 || n >= 10 ? 1 : n >= 1 ? 2 : 3;
  return v.toLocaleString("en-GB", { maximumFractionDigits: decimaler });
}

/** Push labels apart so no two overlap, then keep the column inside the plot. */
function utanKrock<T extends { y: number }>(punkter: T[], ovre: number, undre: number) {
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

function Tabell({
  positioner,
  hovrad,
  sattHovrad,
}: {
  positioner: Position[];
  hovrad: string | null;
  sattHovrad: (n: string | null) => void;
}) {
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-linje text-[10px] uppercase tracking-[0.12em] text-dampad">
          <th className="py-2 font-normal">Competitor</th>
          <th className="py-2 text-right font-normal">Price / month</th>
          <th className="py-2 text-right font-normal">Breadth</th>
          <th className="py-2 text-right font-normal">Revenue</th>
        </tr>
      </thead>
      <tbody>
        {positioner.map((p) => (
          <tr
            key={p.konkurrent}
            onMouseEnter={() => sattHovrad(p.konkurrent)}
            onMouseLeave={() => sattHovrad(null)}
            className={`border-b border-linje ${
              hovrad === p.konkurrent ? "bg-papper-djup" : ""
            }`}
          >
            <td className="py-2 pr-3 text-black">{p.konkurrent}</td>
            <td className="py-2 text-right">
              {p.prisPerManad === null ? (
                <span className="text-dampad">Not published</span>
              ) : (
                <span className="siffror text-black">{tal(p.prisPerManad)} SEK</span>
              )}
            </td>
            <td className="siffror py-2 text-right text-black">{tal(p.bredd)}</td>
            <td className="py-2 text-right">
              {p.omsattningTkr === null ? (
                <span className="text-dampad">—</span>
              ) : (
                <span className="siffror text-black">{tal(p.omsattningTkr / 1000)} MSEK</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Karta({ positioner }: { positioner: Position[] }) {
  const [hovrad, sattHovrad] = useState<string | null>(null);
  if (!positioner.length) return null;

  const medPris = positioner.filter(
    (p): p is Position & { prisPerManad: number } => p.prisPerManad !== null,
  );
  const utanPris = positioner.filter((p) => p.prisPerManad === null);

  const B = 760;
  const H = 390;
  const vanster = 62;
  const topp = 40;
  const botten = 58;
  const bana = utanPris.length > 0 ? 152 : 0;
  const x0 = vanster;
  const x1 = B - 28 - bana;
  const y0 = H - botten;
  const y1 = topp;

  const maxPris = medPris.reduce((m, p) => Math.max(m, p.prisPerManad), 0);
  const steg = snyggtSteg(Math.max(maxPris, 1) / 4);
  const tak = Math.max(steg * Math.ceil(Math.max(maxPris, 1) / steg), steg);
  const ticks: number[] = [];
  for (let v = 0; v <= tak + steg / 1000; v += steg) ticks.push(v);

  const maxBredd = positioner.reduce((m, p) => Math.max(m, p.bredd), 0);
  const breddTak = maxBredd > 0 ? maxBredd * 1.12 : 1;

  const xAv = (v: number) => x0 + (v / tak) * (x1 - x0);
  const yAv = (v: number) => y0 - (v / breddTak) * (y0 - y1);

  const banaX = x1 + 46;
  const banaLinje = x1 + 24;

  const punkter = utanKrock(
    medPris.map((p) => ({ p, x: xAv(p.prisPerManad), y: yAv(p.bredd) })),
    y1,
    y0,
  );
  const banaPunkter = utanKrock(
    utanPris.map((p) => ({ p, x: banaX, y: yAv(p.bredd) })),
    y1,
    y0,
  );

  return (
    <figure className="tryck-hel m-0 flex flex-col gap-5">
      {medPris.length > 0 ? (
        // The table below carries every value, so the drawing is hidden from a screen
        // reader rather than read out as a second, worse copy of the same data.
        <svg
          viewBox={`0 0 ${B} ${H}`}
          width="100%"
          aria-hidden="true"
          className="h-auto w-full overflow-visible"
        >
          {/* Recessive first: grid, then axis, then the data on top of both. */}
          {ticks.map((t) => (
            <line
              key={`rutnat-${t}`}
              x1={xAv(t)}
              y1={y1 - 6}
              x2={xAv(t)}
              y2={y0}
              stroke="var(--linje)"
              strokeWidth="1"
            />
          ))}
          <line x1={x0} y1={y0} x2={x1} y2={y0} stroke="var(--linje)" strokeWidth="1" />

          {ticks.map((t) => (
            <text
              key={`tick-${t}`}
              x={xAv(t)}
              y={y0 + 20}
              textAnchor="middle"
              fontSize="12"
              fill="var(--dampad)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {tal(t)}
            </text>
          ))}
          <text
            x={(x0 + x1) / 2}
            y={y0 + 44}
            textAnchor="middle"
            fontSize="11"
            letterSpacing="1.6"
            fill="var(--dampad)"
          >
            PRICE PER MONTH, SEK
          </text>

          <text x={0} y={y1 + 4} textAnchor="start" fontSize="11" letterSpacing="1.2" fill="var(--dampad)">
            BROAD
          </text>
          <text x={0} y={y0 - 2} textAnchor="start" fontSize="11" letterSpacing="1.2" fill="var(--dampad)">
            NARROW
          </text>

          {/* The honest lane: no price published is not a price of zero. */}
          {utanPris.length > 0 && (
            <>
              <line
                x1={banaLinje}
                y1={y1 - 6}
                x2={banaLinje}
                y2={y0}
                stroke="var(--linje)"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <text x={banaLinje + 10} y={y1 - 24} fontSize="11" letterSpacing="1.2" fill="var(--dampad)">
                NO PRICE
              </text>
              <text x={banaLinje + 10} y={y1 - 10} fontSize="11" letterSpacing="1.2" fill="var(--dampad)">
                PUBLISHED
              </text>
            </>
          )}

          {punkter.map(({ p, x, y, ey }) => {
            const vand = x > x1 - 104;
            const aktiv = hovrad === p.konkurrent;
            return (
              <g
                key={p.konkurrent}
                onMouseEnter={() => sattHovrad(p.konkurrent)}
                onMouseLeave={() => sattHovrad(null)}
              >
                <title>{`${p.konkurrent} — ${tal(p.prisPerManad)} SEK/month`}</title>
                {Math.abs(ey - y) > 4 && (
                  <line
                    x1={vand ? x - 9 : x + 9}
                    y1={y}
                    x2={vand ? x - 15 : x + 15}
                    y2={ey - 4}
                    stroke="var(--linje)"
                    strokeWidth="1"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={aktiv ? 8 : 6}
                  fill="var(--amber)"
                  stroke="var(--papper)"
                  strokeWidth="2"
                />
                <text
                  x={vand ? x - 16 : x + 16}
                  y={ey + 4}
                  textAnchor={vand ? "end" : "start"}
                  fontSize="13"
                  fill="var(--black)"
                  fontWeight={aktiv ? 600 : 400}
                >
                  {kort(p.konkurrent, 16)}
                </text>
                <circle cx={x} cy={y} r="16" fill="transparent" />
              </g>
            );
          })}

          {banaPunkter.map(({ p, x, y, ey }) => {
            const aktiv = hovrad === p.konkurrent;
            return (
              <g
                key={p.konkurrent}
                onMouseEnter={() => sattHovrad(p.konkurrent)}
                onMouseLeave={() => sattHovrad(null)}
              >
                <title>{`${p.konkurrent} — no price published`}</title>
                {Math.abs(ey - y) > 4 && (
                  <line
                    x1={x + 9}
                    y1={y}
                    x2={x + 15}
                    y2={ey - 4}
                    stroke="var(--linje)"
                    strokeWidth="1"
                  />
                )}
                {/* Hollow: same competitor, one fact missing. */}
                <circle
                  cx={x}
                  cy={y}
                  r={aktiv ? 7 : 5.5}
                  fill="var(--papper)"
                  stroke="var(--amber)"
                  strokeWidth="2"
                />
                <text
                  x={x + 16}
                  y={ey + 4}
                  fontSize="13"
                  fill="var(--black)"
                  fontWeight={aktiv ? 600 : 400}
                >
                  {kort(p.konkurrent, 13)}
                </text>
                <circle cx={x} cy={y} r="16" fill="transparent" />
              </g>
            );
          })}
        </svg>
      ) : (
        <p className="text-[15px] leading-relaxed text-dampad">
          Not one of these companies publishes a price, so there is nothing to plot. That
          is itself the finding — the whole market makes you ask.
        </p>
      )}

      <Tabell positioner={positioner} hovrad={hovrad} sattHovrad={sattHovrad} />

      <figcaption className="text-[13px] leading-relaxed text-dampad">
        One dot per competitor. Breadth is how much of the job they cover, counted from
        what their own pages claim; price is the cheapest published monthly plan.
        {utanPris.length > 0 &&
          " The companies on the right publish no price at all — they sit in their own lane rather than at zero, because making you ask is not the same as being free."}
      </figcaption>
    </figure>
  );
}

/* ---------------------------------------------------------------------------
   Filed revenue over time. Small multiples rather than one shared chart: these
   companies sit one to three orders of magnitude apart — a 1.8 bn SEK incumbent
   beside a 1.2 MSEK one-person shop — and on a single linear axis everyone but
   the largest collapses onto the baseline. Indexing every series to 100 at its
   own first filed year was the alternative and was rejected: the series start in
   different years and run for different lengths, so a common base would be a
   fiction, and indexing throws absolute size away entirely. So each panel keeps
   its own zero-based scale (shape is comparable across panels, height is not —
   each panel prints its own ceiling), the year axis is shared so time lines up,
   the headline figure carries absolute size, and growth is stated per year
   rather than as a total because the spans differ. One hue throughout: identity
   comes from the panel heading, never from a colour.
   --------------------------------------------------------------------------- */

type Tillvaxtserie = { konkurrent: string; serie: Bokslutsar[] };

/** tkr is unreadable at a billion, so the number picks its own unit. */
function belopp(tkr: number) {
  const msek = tkr / 1000;
  if (Math.abs(msek) >= 1000) return `${(msek / 1000).toFixed(2)} bn SEK`;
  if (Math.abs(msek) >= 100) return `${tal(Math.round(msek))} MSEK`;
  // Below a million kronor, MSEK stops being readable — say it in tkr.
  if (Math.abs(msek) < 1) return `${tal(tkr)} tkr`;
  return `${tal(msek)} MSEK`;
}

function procent(v: number) {
  const n = Math.abs(v);
  // A tenth of a percent is noise once the change is in the hundreds.
  return `${v >= 0 ? "+" : "−"}${tal(n >= 100 ? Math.round(n) : n)}%`;
}

/** The register hands us newest first; a chart reads left to right. */
function kronologisk(serie: Bokslutsar[]) {
  return [...serie].sort((a, b) => a.ar - b.ar);
}

type Punkt = { ar: number; v: number };

/**
 * Unbroken runs of filed revenue. A null year — or a year simply missing from
 * the filing list — ends the run rather than being bridged, because a straight
 * line through a gap claims a number nobody filed.
 */
function segment(rader: Bokslutsar[]) {
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
function luckor(rader: Bokslutsar[], forsta: number, sista: number) {
  const ut: number[] = [];
  for (let ar = forsta + 1; ar < sista; ar++) {
    const rad = rader.find((r) => r.ar === ar);
    if (!rad || rad.omsattningTkr === null) ut.push(ar);
  }
  return ut;
}

type Analys = {
  namn: string;
  rader: Bokslutsar[];
  punkter: Punkt[];
  /** Per year, not total, so competitors with different spans can be compared. */
  arligt: number | null;
  /** Over that competitor's own span. Lives in the table, where the span is stated. */
  totalt: number | null;
};

function analysera(s: Tillvaxtserie): Analys {
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

function Kurva({
  analys,
  minAr,
  maxAr,
  aktiv,
}: {
  analys: Analys;
  minAr: number;
  maxAr: number;
  aktiv: boolean;
}) {
  const B = 260;
  const H = 104;
  const x0 = 6;
  const x1 = B - 6;
  const y1 = 20;
  const y0 = 78;

  const spann = Math.max(maxAr - minAr, 1);
  const xAv = (ar: number) => x0 + ((ar - minAr) / spann) * (x1 - x0);

  const topp = analys.punkter.reduce((m, p) => Math.max(m, p.v), 0);
  // Thirds rather than halves: a coarser step rounds a panel's ceiling so far above
  // its peak that the curve sinks into the lower half and reads as flat.
  const steg = snyggtSteg(Math.max(topp, 1) / 3);
  const tak = Math.max(steg * Math.ceil(Math.max(topp, 1) / steg), steg);
  const yAv = (v: number) => y0 - (v / tak) * (y0 - y1);

  const bitar = segment(analys.rader);
  const forsta = analys.punkter[0];
  const sist = analys.punkter[analys.punkter.length - 1];
  const hal = forsta && sist ? luckor(analys.rader, forsta.ar, sist.ar) : [];

  return (
    // The table below carries every value, so the drawing is hidden from a screen
    // reader rather than read out as a second, worse copy of the same data.
    <svg
      viewBox={`0 0 ${B} ${H}`}
      width="100%"
      aria-hidden="true"
      className="h-auto w-full overflow-visible"
    >
      <title>{`${analys.namn} — filed revenue ${minAr}–${maxAr}`}</title>

      {/* The ceiling is printed because every panel is scaled to itself. */}
      <text x={x0} y={y1 - 7} fontSize="10" fill="var(--dampad)" style={{ fontVariantNumeric: "tabular-nums" }}>
        {belopp(tak)}
      </text>

      {/* A year nobody filed: a rule where the line is not. Never bridged. */}
      {hal.map((ar) => (
        <line
          key={`lucka-${ar}`}
          x1={xAv(ar)}
          y1={y1}
          x2={xAv(ar)}
          y2={y0}
          stroke="var(--linje)"
          strokeWidth="1"
        />
      ))}

      <line x1={x0} y1={y0} x2={x1} y2={y0} stroke="var(--linje)" strokeWidth="1" />

      {bitar.map((bit, n) => {
        if (bit.length < 2) return null;
        const punkter = bit.map((p) => `${xAv(p.ar)},${yAv(p.v)}`).join(" ");
        const yta = `M ${xAv(bit[0].ar)},${y0} L ${punkter.replaceAll(" ", " L ")} L ${xAv(bit[bit.length - 1].ar)},${y0} Z`;
        return (
          <g key={`bit-${n}`}>
            <path d={yta} fill="var(--amber)" fillOpacity="0.1" />
            <polyline
              points={punkter}
              fill="none"
              stroke="var(--amber)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        );
      })}

      {analys.punkter.map((p, n) => {
        const slut = n === analys.punkter.length - 1;
        return (
          <circle
            key={`p-${p.ar}`}
            cx={xAv(p.ar)}
            cy={yAv(p.v)}
            r={slut ? (aktiv ? 5 : 4) : 2.5}
            fill="var(--amber)"
            stroke={slut ? "var(--papper)" : "none"}
            strokeWidth={slut ? 2 : 0}
          />
        );
      })}

      {[minAr, maxAr].map((ar, n) => (
        <text
          key={`ar-${ar}`}
          x={n === 0 ? x0 : x1}
          y={y0 + 16}
          textAnchor={n === 0 ? "start" : "end"}
          fontSize="10"
          fill="var(--dampad)"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {ar}
        </text>
      ))}
    </svg>
  );
}

function Tillvaxttabell({
  analyser,
  ar,
  hovrad,
  sattHovrad,
}: {
  analyser: Analys[];
  ar: number[];
  hovrad: string | null;
  sattHovrad: (n: string | null) => void;
}) {
  function cell(v: number | null) {
    return v === null ? (
      <span className="text-dampad">—</span>
    ) : (
      <span className="siffror text-black">{tal(v / 1000)}</span>
    );
  }

  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-linje text-[10px] uppercase tracking-[0.12em] text-dampad">
            <th className="py-2 pr-3 font-normal">Competitor</th>
            <th className="py-2 pr-3 font-normal">Figure, MSEK</th>
            {ar.map((a) => (
              <th key={a} className="siffror py-2 pl-3 text-right font-normal">
                {a}
              </th>
            ))}
            <th className="py-2 pl-3 text-right font-normal">Change over span</th>
          </tr>
        </thead>
        <tbody>
          {analyser.map((a) => {
            const markerad = hovrad === a.namn;
            const rad = (
              typ: "omsattning" | "resultat",
            ) => (
              <tr
                key={`${a.namn}-${typ}`}
                onMouseEnter={() => sattHovrad(a.namn)}
                onMouseLeave={() => sattHovrad(null)}
                className={`${typ === "resultat" ? "border-b border-linje" : ""} ${
                  markerad ? "bg-papper-djup" : ""
                }`}
              >
                {typ === "omsattning" ? (
                  <td rowSpan={2} className="py-2 pr-3 align-top text-black">
                    {a.namn}
                  </td>
                ) : null}
                <td className="py-2 pr-3 text-dampad">
                  {typ === "omsattning" ? "Revenue" : "Profit/loss"}
                </td>
                {ar.map((y) => {
                  const r = a.rader.find((x) => x.ar === y);
                  return (
                    <td key={y} className="py-2 pl-3 text-right">
                      {cell(r ? (typ === "omsattning" ? r.omsattningTkr : r.resultatTkr) : null)}
                    </td>
                  );
                })}
                <td className="py-2 pl-3 text-right">
                  {typ === "omsattning" && a.totalt !== null ? (
                    <span className="siffror text-black">{procent(a.totalt)}</span>
                  ) : (
                    <span className="text-dampad">—</span>
                  )}
                </td>
              </tr>
            );
            return [rad("omsattning"), rad("resultat")];
          })}
        </tbody>
      </table>
    </div>
  );
}

function Tillvaxt({ tillvaxt }: { tillvaxt: Tillvaxtserie[] }) {
  const [hovrad, sattHovrad] = useState<string | null>(null);

  const analyser = tillvaxt
    .map(analysera)
    .filter((a) => a.rader.length > 0)
    // Fastest grower first: the exhibit is about rate, so the ranking should be too.
    .sort((a, b) => (b.arligt ?? -Infinity) - (a.arligt ?? -Infinity));

  if (!analyser.length) return null;

  const arSet = new Set<number>();
  for (const a of analyser) for (const r of a.rader) arSet.add(r.ar);
  const ar = [...arSet].sort((a, b) => a - b);
  const minAr = ar[0];
  const maxAr = ar[ar.length - 1];

  const ritbara = analyser.filter((a) => a.punkter.length >= 2);

  return (
    <figure className="tryck-hel m-0 flex flex-col gap-6">
      {ritbara.length > 0 ? (
        <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {analyser.map((a) => {
            const sist = a.punkter[a.punkter.length - 1];
            return (
              <div
                key={a.namn}
                onMouseEnter={() => sattHovrad(a.namn)}
                onMouseLeave={() => sattHovrad(null)}
                className={`tryck-hel flex flex-col gap-1.5 border-t-2 pt-3 transition-colors ${
                  hovrad === a.namn ? "border-amber" : "border-linje"
                }`}
              >
                <span className="text-[13px] leading-snug text-black">{a.namn}</span>
                {/* Proportional figures: a standalone value, not a column to align. */}
                <span className="text-[19px] leading-none text-black">
                  {sist ? belopp(sist.v) : "—"}
                </span>
                <span className="text-[12px] leading-snug text-dampad">
                  {a.arligt === null ? (
                    a.punkter.length ? (
                      `One year filed · ${sist.ar}`
                    ) : (
                      "No revenue figure filed"
                    )
                  ) : (
                    <>
                      <span className={a.arligt >= 0 ? "text-black" : "text-rod"}>
                        {procent(a.arligt)} a year
                      </span>
                      {` · ${a.punkter[0].ar}–${sist.ar}`}
                    </>
                  )}
                </span>
                <div className="mt-1.5">
                  {a.punkter.length >= 2 ? (
                    <Kurva
                      analys={a}
                      minAr={minAr}
                      maxAr={maxAr}
                      aktiv={hovrad === a.namn}
                    />
                  ) : (
                    // An empty frame would imply we drew something. Say the thing instead.
                    <p className="text-[12px] leading-snug text-dampad">
                      Too few filed years to draw a line.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[15px] leading-relaxed text-dampad">
          Every competitor that files has only a single readable year, so there is no
          trend to draw. The filed figures are below.
        </p>
      )}

      <Tillvaxttabell analyser={analyser} ar={ar} hovrad={hovrad} sattHovrad={sattHovrad} />

      <figcaption className="text-[13px] leading-relaxed text-dampad">
        Filed annual accounts from the Swedish company register, oldest year on the
        left. Each panel has its own vertical scale and starts at zero, so the shapes
        are comparable but the heights are not — every panel prints its own ceiling and
        every figure is in the table. Growth is stated per year rather than as a total
        because the series cover different numbers of years. Accounts are filed in
        arrears and lag by up to a year, so the most recent year may be missing. A year
        with no filed figure leaves a break in the line, marked by a faint rule; nothing
        is interpolated across it. These figures exist only for Swedish aktiebolag — a
        competitor missing from this exhibit is one that files nothing here, a foreign
        parent, a branch, a partnership or a sole trader, which is not the same thing as
        being small.
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------------- */

/* ------------------------------------------------------------------------- */

function Rapport({ full }: { full: Fulldata }) {
  return (
    <article className="tryck-ny-sida flex flex-col gap-14 border-t border-linje pt-12">
      <header className="tryck-hel flex flex-col gap-5">
        <span className="text-[11px] uppercase tracking-[0.16em] text-dampad">
          The full report
        </span>
        <h2 className="font-serif text-[32px] leading-[1.12] text-black sm:text-[44px]">
          {full.slutsats}
        </h2>
      </header>

      {full.ogonblick.length > 0 && (
        <section className="tryck-hel flex flex-col gap-5 border border-linje bg-papper-djup p-6 sm:p-8">
          <h3 className="text-[11px] uppercase tracking-[0.16em] text-dampad">At a glance</h3>
          <ul className="flex flex-col gap-4">
            {full.ogonblick.map((o, n) => (
              <li key={`${n}-${o.slice(0, 40)}`} className="flex gap-4">
                <span className="mt-[0.7em] h-px w-4 shrink-0 bg-amber" />
                <span className="text-[17px] leading-snug text-black">{o}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {full.avsnitt.length > 0 && (
        <section className="flex flex-col gap-12">
          {full.avsnitt.map((a, n) => (
            <Avsnittsvy key={`${n}-${a.rubrik}`} avsnitt={a} nummer={n + 1} />
          ))}
        </section>
      )}

      {full.positioner.length > 0 && (
        <section className="tryck-hel flex flex-col gap-6">
          <h3 className="text-[11px] uppercase tracking-[0.16em] text-dampad">
            Where everyone sits
          </h3>
          <Karta positioner={full.positioner} />
        </section>
      )}

      {(full.tillvaxt?.length ?? 0) > 0 && (
        <section className="tryck-hel flex flex-col gap-6">
          <h3 className="text-[11px] uppercase tracking-[0.16em] text-dampad">
            Who is actually growing
          </h3>
          {/* Reports saved before this exhibit existed carry no `tillvaxt` at all. */}
          <Tillvaxt tillvaxt={full.tillvaxt ?? []} />

          <Swotvy swot={full.swot} />
        </section>
      )}

      <section className="tryck-hel grid gap-8 border-t border-linje pt-8 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="text-[11px] uppercase tracking-[0.16em] text-dampad">
            Why these competitors
          </h3>
          <p className="text-[13px] leading-[1.7] text-dampad">{full.urval}</p>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-[11px] uppercase tracking-[0.16em] text-dampad">
            How this was made, and where it stops
          </h3>
          <p className="text-[13px] leading-[1.7] text-dampad">{full.metod}</p>
        </div>
      </section>

      <p className="text-xs text-dampad">
        Written by <span className="siffror">{full.skrivenAv}</span> on{" "}
        <span className="siffror">{datum(full.skapad)}</span>. Verified claims are quoted
        from the pages listed above; judgements are marked as such.
      </p>
    </article>
  );
}

export default function Fullrapport({
  id,
  namn,
  befintlig,
  kanKopa,
  skrivDirekt = false,
}: {
  id: string;
  namn: string;
  befintlig?: Fulldata | null;
  kanKopa: boolean;
  /** The visitor arrived here in order to write it. See the effect below. */
  skrivDirekt?: boolean;
}) {
  /**
   * The one case where the run is settled before the first paint: the reader
   * pressed "Write the full report" in the other tab, so this tab must never
   * show them that button again, not even for the moment between the server's
   * HTML and hydration. The effect below does the actual starting.
   */
  const skrivPaEnGang = skrivDirekt && !befintlig && kanKopa;
  const [arbetar, sattArbetar] = useState(skrivPaEnGang);
  const [rader, sattRader] = useState<string[]>([]);
  const [avsnitt, sattAvsnitt] = useState<Avsnitt[]>([]);
  const [full, sattFull] = useState<Fulldata | null>(null);
  const [fel, sattFel] = useState<string | null>(null);
  const [sekunder, sattSekunder] = useState(0);
  const avbryt = useRef<AbortController | null>(null);
  const startad = useRef(false);

  // A stored report is the same thing a run would produce, so it wins outright.
  const visad = full ?? befintlig ?? null;

  useEffect(() => () => avbryt.current?.abort(), []);

  useEffect(() => {
    if (!arbetar) return;
    const klocka = setInterval(() => sattSekunder((s) => s + 1), 1000);
    return () => clearInterval(klocka);
  }, [arbetar]);

  function hantera(h: FullHandelse) {
    switch (h.typ) {
      case "steg":
        sattRader((r) => [...r, h.text]);
        break;
      case "avsnitt":
        sattAvsnitt((a) =>
          a.some((x) => x.rubrik === h.avsnitt.rubrik) ? a : [...a, h.avsnitt],
        );
        break;
      case "klar":
        sattFull(h.full);
        sattArbetar(false);
        break;
      case "fel":
        sattFel(h.text);
        sattArbetar(false);
        break;
    }
  }

  async function starta(automatiskt = false) {
    // An automatic run is already shown as working, so its own flag is not a
    // second press to be swallowed here.
    if (arbetar && !automatiskt) return;
    sattArbetar(true);
    sattFel(null);
    sattRader([]);
    sattAvsnitt([]);
    sattSekunder(0);

    avbryt.current?.abort();
    const styr = new AbortController();
    avbryt.current = styr;

    try {
      const svar = await fetch("/api/full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
        signal: styr.signal,
      });

      if (!svar.ok || !svar.body) throw new Error(await svar.text());

      const lasare = svar.body.getReader();
      const avkodare = new TextDecoder();
      let buffert = "";

      for (;;) {
        const { done, value } = await lasare.read();
        if (done) break;
        buffert += avkodare.decode(value, { stream: true });

        const bitar = buffert.split("\n\n");
        buffert = bitar.pop() ?? "";

        for (const bit of bitar) {
          const rad = bit.trim();
          if (!rad.startsWith("data: ")) continue;
          hantera(JSON.parse(rad.slice(6)) as FullHandelse);
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      sattFel(e instanceof Error ? e.message : "The report could not be finished.");
    } finally {
      sattArbetar(false);
    }
  }

  /**
   * Arriving to write it.
   *
   * The intent lives in the address — `?skriv=1`, set on the link that opened
   * this tab — rather than in a session or a header, because the address is the
   * only thing a new tab carries with it, and because it keeps the two cases
   * apart that must not be confused: a reader who pressed "Write the full
   * report" meant to spend the two to four minutes, and someone opening a
   * bookmark or a link a colleague sent did not. The second must never be
   * charged for a job they did not ask for, so absent the parameter we show the
   * button and wait.
   *
   * The parameter is consumed the moment it is honoured: the run starts and the
   * address is rewritten back to the bare path. That is what makes a reload mid
   * run safe — the reloaded page no longer carries the intent, so it lands on
   * the button rather than starting a second run behind the first. The ref
   * guards the same thing within one mount, where React may run this twice.
   */
  useEffect(() => {
    // `skrivPaEnGang` already excludes a stored report and an unpaid one, so
    // neither can be made to spend a run from the address bar.
    if (!skrivPaEnGang || startad.current) return;
    startad.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    // Off the commit: `starta` sets state on its first line, and doing that
    // inside the effect body would re-render before this one has landed.
    void Promise.resolve().then(() => starta(true));
    // `starta` is left out of the deps on purpose: it is redefined every
    // render but closes over nothing that changes here — the page is keyed on
    // the report id — and listing it would re-run this effect forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skrivPaEnGang]);

  if (visad && !arbetar) return <Rapport full={visad} />;

  // The three arguments announce themselves as they start and finish, so the
  // roster can be drawn from the progress lines rather than hardcoded here.
  const vinklar: { etikett: string; klar: boolean }[] = [];
  for (const r of rader) {
    const start = r.match(/^Writing: (.+)$/);
    if (start && !vinklar.some((v) => v.etikett === start[1])) {
      vinklar.push({ etikett: start[1], klar: false });
    }
    const slut = r.match(/^Done: (.+)$/);
    if (slut) {
      const v = vinklar.find((x) => x.etikett === slut[1]);
      if (v) v.klar = true;
    }
  }

  if (arbetar) {
    return (
      <section className="ej-tryck flex flex-col gap-10 border-t border-linje pt-12">
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2.5 text-[11px] uppercase tracking-[0.16em] text-dampad">
            <Svep
              totalt={vinklar.length}
              klara={vinklar.filter((v) => v.klar).length}
            />
            {avsnitt.length === 0
              ? "Reading the evidence again"
              : `${avsnitt.length} ${avsnitt.length === 1 ? "argument" : "arguments"} written`}
            <span className="siffror text-dampad"> · {sekunder}s</span>
          </span>
          <h2 className="font-serif text-3xl leading-tight text-black sm:text-4xl">
            Building the case for <em className="not-italic text-amber">{namn}</em>
          </h2>
          <p className="max-w-lg text-[15px] leading-relaxed text-dampad">
            Researchers read every competitor from five angles, then three writers argue
            the case in parallel and the conclusion is drawn over them. Two to four
            minutes. You can leave this open.
          </p>
        </div>

        {vinklar.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {vinklar.map((v) => (
              <li
                key={v.etikett}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors duration-500 ${
                  v.klar
                    ? "border-linje bg-papper-djup text-black"
                    : "border-linje/70 bg-transparent text-dampad"
                }`}
              >
                {/* Same tick as on the scale above: an argument on the chip and
                    its mark on the rule are the same object. */}
                <span className={`svep-tand${v.klar ? " svep-tand-klar" : ""}`} />
                {v.etikett}
              </li>
            ))}
          </ul>
        )}

        {rader.length > 0 && (
          <div className="flex max-h-64 flex-col gap-1.5 overflow-hidden">
            {rader
              .filter((r) => !/^(Writing|Done): /.test(r))
              .slice(-9)
              .map((r, i, alla) => (
                <p
                  key={`${r}-${i}`}
                  className="siffror text-sm text-dampad"
                  style={{
                    opacity: 0.25 + (0.75 * (i + 1)) / alla.length,
                    animation: "stig 0.4s ease-out both",
                  }}
                >
                  {r}
                </p>
              ))}
          </div>
        )}

        {avsnitt.length > 0 && (
          <div className="flex flex-col gap-12 border-t border-linje pt-10">
            {avsnitt.map((a, n) => (
              <div key={`${n}-${a.rubrik}`} style={{ animation: "stig 0.4s ease-out both" }}>
                <Avsnittsvy avsnitt={a} nummer={n + 1} />
              </div>
            ))}
          </div>
        )}

      </section>
    );
  }

  // The purchase screen is somebody else's job; until it is done, we show nothing.
  if (!kanKopa) return null;

  return (
    <section className="ej-tryck flex flex-col gap-3 border-t border-linje pt-12">
      <h2 className="text-[11px] uppercase tracking-[0.16em] text-dampad">The full report</h2>
      <p className="max-w-lg text-[15px] leading-relaxed text-dampad">
        One answer, argued in three parts, with every claim marked by how far it sits
        from the page it came from — plus the price-against-breadth map and a note on
        why these competitors and not others. Written to be printed and handed over.
      </p>
      <button
        type="button"
        onClick={() => starta()}
        className="mt-2 self-start border border-black px-5 py-2.5 text-sm text-black transition-colors hover:bg-black hover:text-papper"
      >
        Write the full report
      </button>
      <p className="text-xs text-dampad">Takes two to four minutes.</p>
      {fel && (
        <p className="text-sm text-rod">
          {fel} Nothing was lost — you can start it again.
        </p>
      )}
    </section>
  );
}
