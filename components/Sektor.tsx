"use client";

import { useState } from "react";
import {
  belopp,
  kort,
  kronologisk,
  procent,
  snyggtSteg,
  tal,
  type Punkt,
} from "@/lib/diagram";
import type { Bokslutsar, Konkurrent } from "@/lib/types";

/**
 * Two exhibits the company register gives us for free, and that no competitor
 * tool built for the US market can print at all.
 *
 * The first asks whether the market is growing, by adding up what every
 * competitor filed. The second asks when these companies appeared, which is
 * usually the more startling of the two: a set of competitors that were all
 * registered in the last few years is a market being entered, and that is a
 * different strategic situation from a settled one.
 *
 * Coverage is thin and thin is the normal case — most competitors are foreign,
 * a branch or a sole trader and file nothing here. Neither exhibit is allowed
 * to draw an empty frame: when there is not enough to plot, it says so in a
 * sentence and keeps the table, because a stated gap is information and a blank
 * chart is an accusation against the reader's eyesight.
 */

export type Sektorprops = {
  /** Every competitor in the report, filed or not. Coverage is computed here. */
  konkurrenter: Konkurrent[];
  /**
   * The reader's own company, read the same way a competitor is. It is drawn on
   * the entry timeline in the second hue — "when did I arrive relative to them"
   * is the only question they bring to that exhibit — and deliberately left out
   * of the sector total, which is about the competitors.
   */
  egen?: Konkurrent | null;
  /** The name to label the own row with; the register name is often not it. */
  egetNamn?: string;
};

/* ---------------------------------------------------------------------------
   Reading the register.
   --------------------------------------------------------------------------- */

/**
 * One company's filed revenue by year. The five-year history when the register
 * gave us one, otherwise the single latest figure — a company with one readable
 * year still filed that year, and dropping it would understate the sector total
 * exactly where coverage is already thinnest. A year that appears twice is
 * counted once, so a duplicated filing cannot inflate a sum.
 */
function filade(k: Konkurrent): Punkt[] {
  const o = k.orgdata;
  if (!o) return [];
  // Reports written before this field existed simply have no `historik`, and
  // the type cannot say so. A stored report is data from the past, not a value
  // the current code produced.
  const historik = o.historik ?? [];
  const rader: Bokslutsar[] = historik.length
    ? historik
    : o.ar !== null && o.omsattningTkr !== null
      ? [{ ar: o.ar, omsattningTkr: o.omsattningTkr, resultatTkr: o.resultatTkr }]
      : [];
  const sedda = new Set<number>();
  const ut: Punkt[] = [];
  for (const r of kronologisk(rader)) {
    if (r.omsattningTkr === null || sedda.has(r.ar)) continue;
    sedda.add(r.ar);
    ut.push({ ar: r.ar, v: r.omsattningTkr });
  }
  return ut;
}

/**
 * A registration year we are willing to put on a time axis. The field is read
 * off a register page and a single bad parse — a year 0, a year 3000 — would
 * stretch the axis until every real dot collapsed into one pixel. Out-of-range
 * values are treated as no date at all, which is what they are.
 */
function rimligtAr(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 1800 && v <= 2100
    ? Math.round(v)
    : null;
}

type Filare = { namn: string; punkter: Punkt[]; summa: number };
type Kolumn = { ar: number; total: number | null; namn: string[] };

/* ---------------------------------------------------------------------------
   Exhibit 1 — the sector total.

   Columns, not a line. A line says one thing was measured repeatedly; this is a
   sum over a set that changes membership from year to year, and each column is
   a different sum. Drawing it as a continuous curve would smuggle in a
   continuity the data does not have.

   That composition problem is the whole risk of the exhibit, so it is not left
   to the caption alone: under the year axis is a strip with one row per filing
   company and one mark per year, so a reader can see for themselves that the
   2023 column contains a company the 2022 column did not. A jump with a new row
   appearing beneath it is composition; a jump with the same rows underneath is
   growth. There are no horizontal gridlines and no value axis — every column is
   labelled with its own total, which is more precise than a gridline and is the
   same direct-labelling rule the rest of the product follows.
   --------------------------------------------------------------------------- */

function Sektortabell({
  filare,
  kolumner,
  hovAr,
  sattHovAr,
}: {
  filare: Filare[];
  kolumner: Kolumn[];
  hovAr: number | null;
  sattHovAr: (a: number | null) => void;
}) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="pb-2 text-left text-[10px] uppercase tracking-[0.12em] text-dampad">
          Filed revenue, MSEK
        </caption>
        <thead>
          <tr className="border-b border-linje text-[10px] uppercase tracking-[0.12em] text-dampad">
            <th className="py-2 pr-3 font-normal">Competitor</th>
            {kolumner.map((k) => (
              <th
                key={k.ar}
                onMouseEnter={() => sattHovAr(k.ar)}
                onMouseLeave={() => sattHovAr(null)}
                className={`data py-2 pl-3 text-right font-normal ${
                  hovAr === k.ar ? "bg-upphojd" : ""
                }`}
              >
                {k.ar}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filare.map((f) => (
            <tr key={f.namn} className="border-b border-linje">
              <td className="py-2 pr-3 text-black">{f.namn}</td>
              {kolumner.map((k) => {
                const p = f.punkter.find((x) => x.ar === k.ar);
                return (
                  <td
                    key={k.ar}
                    onMouseEnter={() => sattHovAr(k.ar)}
                    onMouseLeave={() => sattHovAr(null)}
                    className={`py-2 pl-3 text-right ${hovAr === k.ar ? "bg-upphojd" : ""}`}
                  >
                    {p ? (
                      <span className="data text-black">{tal(p.v / 1000)}</span>
                    ) : (
                      <span className="text-dampad">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {/* The two rows the exhibit is actually about, and they belong together:
              a total means nothing without the count of companies behind it. */}
          <tr className="border-b border-linje">
            <td className="py-2 pr-3 font-medium text-black">Sector total</td>
            {kolumner.map((k) => (
              <td
                key={k.ar}
                onMouseEnter={() => sattHovAr(k.ar)}
                onMouseLeave={() => sattHovAr(null)}
                className={`py-2 pl-3 text-right ${hovAr === k.ar ? "bg-upphojd" : ""}`}
              >
                {k.total === null ? (
                  <span className="text-dampad">—</span>
                ) : (
                  <span className="data font-medium text-black">{tal(k.total / 1000)}</span>
                )}
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-2 pr-3 text-dampad">Companies filing</td>
            {kolumner.map((k) => (
              <td
                key={k.ar}
                onMouseEnter={() => sattHovAr(k.ar)}
                onMouseLeave={() => sattHovAr(null)}
                className={`py-2 pl-3 text-right ${hovAr === k.ar ? "bg-upphojd" : ""}`}
              >
                <span className="data text-dampad">{k.namn.length}</span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function Sektorintakt({ konkurrenter, egen = null }: Sektorprops) {
  const [hovAr, sattHovAr] = useState<number | null>(null);

  const filare: Filare[] = konkurrenter
    .map((k) => ({ namn: k.namn, punkter: filade(k) }))
    .filter((f) => f.punkter.length > 0)
    .map((f) => ({ ...f, summa: f.punkter.reduce((s, p) => s + p.v, 0) }))
    // Biggest contributor on the top row of the strip: the reader judging the
    // composition caveat needs to know which company moves the total.
    .sort((a, b) => b.summa - a.summa);

  if (!filare.length) {
    return (
      <figure className="tryck-hel m-0 flex flex-col gap-4">
        <p className="text-[15px] leading-relaxed text-dampad">
          Not one of these competitors files annual accounts in Sweden, so there is no
          sector total to add up. That is a finding rather than a hole: a field of
          foreign companies, branches and sole traders is a field where nobody has to
          publish what they earn, and where you cannot be measured against them either.
        </p>
        <figcaption className="text-[13px] leading-relaxed text-dampad">
          Filed annual accounts exist only for Swedish aktiebolag. A competitor absent
          here files nothing in Sweden, which is not the same thing as being small.
        </figcaption>
      </figure>
    );
  }

  const arAlla = filare.flatMap((f) => f.punkter.map((p) => p.ar));
  const minAr = Math.min(...arAlla);
  const maxAr = Math.max(...arAlla);
  // Contiguous: a year in the middle that nobody filed is a hole in the axis, not
  // a year that does not exist. It gets no column and no zero.
  const kolumner: Kolumn[] = [];
  for (let a = minAr; a <= maxAr; a++) {
    const inne = filare.filter((f) => f.punkter.some((p) => p.ar === a));
    kolumner.push({
      ar: a,
      total: inne.length
        ? inne.reduce((s, f) => s + (f.punkter.find((p) => p.ar === a)?.v ?? 0), 0)
        : null,
      namn: inne.map((f) => f.namn),
    });
  }

  const medTotal = kolumner.filter(
    (k): k is Kolumn & { total: number } => k.total !== null,
  );
  const forsta = medTotal[0];
  const sista = medTotal[medTotal.length - 1];
  const ritbar = medTotal.length >= 2;

  /**
   * The longest run of consecutive years filed by exactly the same companies.
   *
   * This is the only stretch of the chart where a change in the total is growth
   * rather than arithmetic, and finding it is what keeps the exhibit honest.
   * Accounts lag by up to a year, so the newest column almost always holds a
   * fraction of the field — putting a percentage across the whole span would
   * print a collapse that never happened, which is exactly the mistake this
   * exhibit exists to prevent.
   */
  function likaMotLika() {
    const nyckel = (k: Kolumn) => [...k.namn].sort().join("|");
    let basta: { i: number; j: number } | null = null;
    let i = 0;
    while (i < kolumner.length) {
      if (kolumner[i].total === null) {
        i++;
        continue;
      }
      let j = i;
      while (
        j + 1 < kolumner.length &&
        kolumner[j + 1].total !== null &&
        nyckel(kolumner[j + 1]) === nyckel(kolumner[i])
      ) {
        j++;
      }
      const langd = j - i + 1;
      const basLangd = basta ? basta.j - basta.i + 1 : 0;
      // Ties go to the run with more companies in it — a long run of a thin field
      // says less about the market than a short run of the whole field — and then
      // to the later run, because a reader asking whether the market is growing
      // means lately.
      if (
        langd > basLangd ||
        (basta !== null &&
          langd === basLangd &&
          kolumner[i].namn.length >= kolumner[basta.i].namn.length)
      ) {
        basta = { i, j };
      }
      i = j + 1;
    }
    return basta && basta.j > basta.i ? basta : null;
  }

  const jamforbar = ritbar ? likaMotLika() : null;

  /** The exhibit's reading, stated only over years that can be compared. */
  function lasning() {
    if (!ritbar || !forsta || !sista) return null;
    if (filare.length === 1) {
      const andel =
        forsta.total > 0 && sista.ar > forsta.ar
          ? ` — ${procent((sista.total / forsta.total - 1) * 100)} between ${forsta.ar} and ${sista.ar}`
          : "";
      return `Only ${filare[0].namn} files here, so this "sector total" is that one company's revenue${andel}. It is a company's trend wearing a market's name.`;
    }
    if (!jamforbar) {
      return `No two years here were filed by the same set of companies, so no change in this total is a change in the market — each column is a sum over a different field. The columns run from ${belopp(forsta.total)} in ${forsta.ar} to ${belopp(sista.total)} in ${sista.ar}, and the strip below shows why those two are not the same measurement.`;
    }
    const fran = kolumner[jamforbar.i] as Kolumn & { total: number };
    const till = kolumner[jamforbar.j] as Kolumn & { total: number };
    const andel = fran.total > 0 ? (till.total / fran.total - 1) * 100 : null;
    const helaSpannet = jamforbar.j - jamforbar.i + 1 === medTotal.length;
    const rorelse =
      andel === null
        ? "went"
        : andel >= 0
          ? `grew ${procent(andel)}`
          : `shrank ${procent(andel)}`;
    // A run of one company is not a sector reading, so it is not allowed to sound
    // like one: it gets named, and the sentence says what it is.
    const forsta_ =
      fran.namn.length === 1
        ? `Only ${fran.namn[0]} filed in every year from ${fran.ar} to ${till.ar}; it ${rorelse} to ${belopp(till.total)}. That is one company's line, not the field's.`
        : `The ${tal(fran.namn.length)} companies that filed in every year from ${fran.ar} to ${till.ar} ${rorelse} between them, to ${belopp(till.total)}.`;
    if (helaSpannet) {
      return `${forsta_} Every column here holds the same companies, so they compare like with like.`;
    }
    const utanfor = kolumner.filter(
      (k, n): k is Kolumn & { total: number } =>
        k.total !== null && (n < jamforbar.i || n > jamforbar.j),
    );
    // Counts, not "n of them": the companies in an outside column are a different
    // set, not a subset of the run, and saying otherwise would be a small lie.
    const lista = utanfor
      .slice(0, 4)
      .map((k, n) => `${k.ar} has ${tal(k.namn.length)}${n === 0 ? (k.namn.length === 1 ? " company" : " companies") : ""}`)
      .join(", ");
    return `${forsta_} The other columns are sums over a different set — ${lista}${utanfor.length > 4 ? ", and so on" : ""} — so they are not points on the same line. Accounts lag by up to a year, so the newest column is usually short of companies rather than short of revenue.`;
  }

  const text = lasning();

  /* Geometry. Fixed integer viewBox; only the strip's height follows the number
     of filing companies. */
  const B = 792;
  const ranna = 120;
  const x0 = 132;
  const x1 = 776;
  const y1 = 46;
  const y0 = 224;
  const yAr = 246;
  const yRubrik = 274;
  const yStrip = 296;
  const radhojd = 19;
  const stripBotten = yStrip + (filare.length - 1) * radhojd;
  const H = stripBotten + 18;

  const steg2 = (x1 - x0) / kolumner.length;
  const mitt = (n: number) => x0 + (n + 0.5) * steg2;
  const stapelbredd = Math.min(46, steg2 * 0.52);

  const topp = medTotal.reduce((m, k) => Math.max(m, k.total), 0);
  // Zero-based, ceiling rounded up to a whole step, so the tallest column has
  // headroom and the printed ceiling is a round number.
  const steg = snyggtSteg(Math.max(topp, 1) / 4);
  const tak = Math.max(steg * Math.ceil(Math.max(topp, 1) / steg), steg);
  const yAv = (v: number) => y0 - (v / tak) * (y0 - y1);

  // Value labels are direct labelling, so they must all fit; past eight columns
  // they cannot, and every other one is dropped from the drawing rather than
  // shrunk into illegibility. The table keeps all of them.
  const glesa = kolumner.length > 8;

  return (
    <figure className="tryck-hel m-0 flex flex-col gap-5">
      {ritbar ? (
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
            <title>{`Filed revenue of every competitor that files, ${minAr}–${maxAr}`}</title>

            {/* Recessive first: the hover band, then the grid, then the axis, then data. */}
            {hovAr !== null && (
              <rect
                x={mitt(hovAr - minAr) - steg2 / 2}
                y={y1 - 12}
                width={steg2}
                height={stripBotten + 8 - (y1 - 12)}
                fill="var(--upphojd)"
              />
            )}

            {kolumner.map((k, n) => (
              <g key={`rutnat-${k.ar}`}>
                <line
                  x1={mitt(n)}
                  y1={y1 - 6}
                  x2={mitt(n)}
                  y2={y0}
                  stroke="var(--linje)"
                  strokeWidth="1"
                />
                {/* Carried on below the year label so the strip's marks sit on the
                    same rules as the columns they belong to. */}
                <line
                  x1={mitt(n)}
                  y1={yRubrik - 6}
                  x2={mitt(n)}
                  y2={stripBotten + 8}
                  stroke="var(--linje)"
                  strokeWidth="1"
                />
              </g>
            ))}

            <line x1={x0} y1={y0} x2={x1} y2={y0} stroke="var(--linje)" strokeWidth="1" />

            {/* No horizontal gridlines: the ceiling and the zero state the scale, and
                every column states its own value. */}
            <text
              x={ranna}
              y={y1 + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--dampad)"
              className="data"
            >
              {belopp(tak)}
            </text>
            <text
              x={ranna}
              y={y0 + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--dampad)"
              className="data"
            >
              0
            </text>

            {kolumner.map((k, n) => {
              const aktiv = hovAr === k.ar;
              const visaVarde = !glesa || n % 2 === kolumner.length % 2;
              return (
                <g key={`kolumn-${k.ar}`}>
                  {k.total === null ? (
                    // Nobody filed this year. No column, no zero — a dash where the
                    // column is not, and every row of the strip below says the same.
                    <text
                      x={mitt(n)}
                      y={y0 - 9}
                      textAnchor="middle"
                      fontSize="12"
                      fill="var(--dampad)"
                    >
                      —
                    </text>
                  ) : (
                    <>
                      <rect
                        x={mitt(n) - stapelbredd / 2}
                        y={yAv(k.total)}
                        width={stapelbredd}
                        height={Math.max(y0 - yAv(k.total), 1)}
                        fill="var(--amber)"
                      />
                      {visaVarde && (
                        <text
                          x={mitt(n)}
                          y={yAv(k.total) - 9}
                          textAnchor="middle"
                          fontSize="12"
                          fill="var(--black)"
                          fontWeight={aktiv ? 600 : 400}
                          className="data"
                        >
                          {belopp(k.total)}
                        </text>
                      )}
                    </>
                  )}
                  <text
                    x={mitt(n)}
                    y={yAr}
                    textAnchor="middle"
                    fontSize="12"
                    fill={aktiv ? "var(--black)" : "var(--dampad)"}
                    className="data"
                  >
                    {k.ar}
                  </text>
                </g>
              );
            })}

            <text x={0} y={yRubrik} fontSize="11" letterSpacing="1.6" fill="var(--dampad)">
              WHO IS IN EACH COLUMN
            </text>

            {filare.map((f, rad) => {
              const y = yStrip + rad * radhojd;
              return (
                <g key={`rad-${f.namn}`}>
                  <text
                    x={ranna}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="var(--black)"
                  >
                    {kort(f.namn, 17)}
                  </text>
                  {kolumner.map((k, n) =>
                    f.punkter.some((p) => p.ar === k.ar) ? (
                      <circle
                        key={`m-${k.ar}`}
                        cx={mitt(n)}
                        cy={y}
                        r="3.2"
                        fill="var(--amber)"
                      />
                    ) : (
                      // Absent, not zero. A short rule reads as "nothing here" where a
                      // hollow dot would read as a different kind of value.
                      <line
                        key={`m-${k.ar}`}
                        x1={mitt(n) - 3.5}
                        y1={y}
                        x2={mitt(n) + 3.5}
                        y2={y}
                        stroke="var(--ask)"
                        strokeWidth="1.5"
                      />
                    ),
                  )}
                </g>
              );
            })}

            {/* Enlarged hit targets last, so nothing drawn can swallow the pointer. */}
            {kolumner.map((k, n) => (
              <rect
                key={`traff-${k.ar}`}
                x={mitt(n) - steg2 / 2}
                y={y1 - 12}
                width={steg2}
                height={stripBotten + 8 - (y1 - 12)}
                fill="transparent"
                onMouseEnter={() => sattHovAr(k.ar)}
                onMouseLeave={() => sattHovAr(null)}
              />
            ))}
          </svg>
        </div>
      ) : (
        // One year of filings is a figure, not a trend. An empty frame would imply
        // we drew something; say the thing instead.
        <p className="text-[15px] leading-relaxed text-dampad">
          {forsta
            ? `Only one year of filings could be read across this field — ${belopp(forsta.total)} from ${forsta.namn.length === 1 ? "one company" : `${tal(forsta.namn.length)} companies`} in ${forsta.ar}. One year is a figure, not a direction.`
            : "No competitor filed a readable revenue figure, so there is no total to draw."}
        </p>
      )}

      {text && <p className="text-[15px] leading-relaxed text-black">{text}</p>}

      <Sektortabell
        filare={filare}
        kolumner={kolumner}
        hovAr={hovAr}
        sattHovAr={sattHovAr}
      />

      <figcaption className="text-[13px] leading-relaxed text-dampad">
        {ritbar
          ? "The set of companies behind each column changes from year to year, so a jump can mean a new competitor started filing rather than the market growing — the strip under the axis shows exactly who is in each column, and the count is in the table. "
          : "A sector total is only as comparable as the set of companies behind it, and that set changes from year to year — the count is in the table. "}
        Figures are filed annual accounts from the Swedish company register, summed
        across every competitor with a readable revenue figure that year; the table is
        in MSEK. Accounts are filed in arrears and lag by up to a year, so the most
        recent year is usually short of companies rather than short of revenue. A year
        nobody filed is left as a gap, never as a zero.
        {egen ? " Your own filed revenue is not in this total; these are the competitors." : ""}
        {" These figures exist only for Swedish aktiebolag — a competitor missing from this exhibit files nothing here, being a foreign company, a branch, a partnership or a sole trader, which is not the same thing as being small."}
      </figcaption>
    </figure>
  );
}

/* ---------------------------------------------------------------------------
   Exhibit 2 — when these companies appeared.

   A row per company on a shared year axis, sorted oldest at the top: a dot plot,
   not a histogram. A histogram of six companies is a row of bars of height one
   and two that reads as noise, and it throws away the identity — and identity is
   the whole point here, because "four of your six competitors were registered
   after 2020" only becomes actionable when you can see which four. The sorted
   rows still give the histogram's shape for free: entrants bunched into recent
   years show up as a staircase that falls off a cliff on the right, readable in
   one glance, while the names stay attached.

   The reader's own company is a row in the second hue, in its chronological
   place, because the only thing they want from this exhibit is whether they were
   early or late.
   --------------------------------------------------------------------------- */

type Entre = { namn: string; ar: number | null; egen: boolean };

function Etableringstabell({
  poster,
  egenAr,
  hovNamn,
  sattHovNamn,
}: {
  poster: Entre[];
  egenAr: number | null;
  hovNamn: string | null;
  sattHovNamn: (n: string | null) => void;
}) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-linje text-[10px] uppercase tracking-[0.12em] text-dampad">
            <th className="py-2 pr-3 font-normal">Company</th>
            <th className="py-2 pl-3 text-right font-normal">Registered</th>
            {egenAr !== null && (
              <th className="py-2 pl-3 text-right font-normal">Against you</th>
            )}
          </tr>
        </thead>
        <tbody>
          {poster.map((p) => {
            const markerad = hovNamn === p.namn;
            const skillnad = egenAr !== null && p.ar !== null ? p.ar - egenAr : null;
            return (
              <tr
                key={p.namn}
                onMouseEnter={() => sattHovNamn(p.namn)}
                onMouseLeave={() => sattHovNamn(null)}
                className={`border-b border-linje ${markerad ? "bg-upphojd" : ""}`}
              >
                <td className={`py-2 pr-3 ${p.egen ? "text-du" : "text-black"}`}>
                  {p.namn}
                  {p.egen ? " (you)" : ""}
                </td>
                <td className="py-2 pl-3 text-right">
                  {p.ar === null ? (
                    <span className="text-dampad">—</span>
                  ) : (
                    <span className="data text-black">{p.ar}</span>
                  )}
                </td>
                {egenAr !== null && (
                  <td className="py-2 pl-3 text-right">
                    {/* The own row has nothing to compare itself with. */}
                    {p.egen || skillnad === null ? (
                      <span className="text-dampad">—</span>
                    ) : skillnad === 0 ? (
                      <span className="text-dampad">same year</span>
                    ) : (
                      <span className="data text-black">
                        {skillnad > 0
                          ? `${tal(skillnad)} yr later`
                          : `${tal(-skillnad)} yr earlier`}
                      </span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Etablering({ konkurrenter, egen = null, egetNamn }: Sektorprops) {
  const [hovNamn, sattHovNamn] = useState<string | null>(null);

  const poster: Entre[] = [
    ...konkurrenter.map((k) => ({
      namn: k.namn,
      ar: rimligtAr(k.orgdata?.registreringsar),
      egen: false,
    })),
    ...(egen
      ? [
          {
            namn: egetNamn?.trim() || egen.namn,
            ar: rimligtAr(egen.orgdata?.registreringsar),
            egen: true,
          },
        ]
      : []),
  ];

  const daterade = poster
    .filter((p): p is Entre & { ar: number } => p.ar !== null)
    .sort((a, b) => a.ar - b.ar);
  const odaterade = poster.filter((p) => p.ar === null);
  // The table is ordered the way the chart is, oldest first, undated at the end.
  const tabellposter = [...daterade, ...odaterade];

  const egenAr = poster.find((p) => p.egen)?.ar ?? null;
  const konkurrentAr = daterade.filter((p) => !p.egen);
  const ritbar = daterade.length >= 2;

  /* Geometry. Rows breathe further apart when there are only a few of them, so
     two companies read as a deliberate timeline rather than a chart that failed
     to fill. */
  const B = 792;
  const ranna = 168;
  const x0 = 176;
  const x1 = 732;
  const radhojd = daterade.length <= 3 ? 34 : 26;
  const yRad0 = 32;
  const yBas = yRad0 + Math.max(daterade.length - 1, 0) * radhojd + 24;
  const H = yBas + 54;

  const minData = daterade.length ? daterade[0].ar : 0;
  const maxData = daterade.length ? daterade[daterade.length - 1].ar : 0;
  // A year axis has no meaningful zero, so it is not zero-based; it is rounded
  // the same way — the step comes from snyggtSteg and the left edge falls back
  // to a whole step below the oldest entrant.
  const steg = Math.max(1, Math.round(snyggtSteg(Math.max(maxData - minData, 4) / 4)));
  const minAxel = Math.floor(minData / steg) * steg;
  // The newest entrant sits at the right edge rather than inside a padded axis:
  // padding a time axis into the future implies years that have not happened.
  const maxAxel = maxData > minAxel ? maxData : minAxel + steg;
  const xAv = (ar: number) => x0 + ((ar - minAxel) / (maxAxel - minAxel)) * (x1 - x0);

  const ticks: number[] = [];
  for (let a = minAxel; a <= maxAxel; a += steg) ticks.push(a);

  /**
   * The finding, stated from the data and nothing else. No sentence here calls a
   * year "recent": the component has no clock — rendering must be identical on
   * the server — and a threshold we picked would be an opinion wearing a number.
   * The years are printed and the reader knows what year it is.
   */
  function lasning() {
    if (!konkurrentAr.length) return null;
    const aldst = konkurrentAr[0];
    const senaste = konkurrentAr[konkurrentAr.length - 1];
    const fran = senaste.ar - 9;
    const inom = konkurrentAr.filter((p) => p.ar >= fran);
    const delar: string[] = [];
    if (konkurrentAr.length === 1) {
      delar.push(
        `Only one competitor has a registration date on file: ${aldst.namn}, registered ${aldst.ar}.`,
      );
    } else if (konkurrentAr.length === 2) {
      delar.push(
        `${aldst.namn} was registered in ${aldst.ar} and ${senaste.namn} in ${senaste.ar} — ${tal(senaste.ar - aldst.ar)} years apart.`,
      );
    } else if (inom.length === konkurrentAr.length) {
      delar.push(
        `All ${tal(konkurrentAr.length)} competitors with a registration date arrived inside a single decade, ${aldst.ar}–${senaste.ar}. This is a field being entered, not a settled one.`,
      );
    } else {
      delar.push(
        `${tal(inom.length)} of the ${tal(konkurrentAr.length)} competitors with a registration date were registered in ${fran}–${senaste.ar}, and the oldest goes back to ${aldst.ar}.`,
      );
    }
    if (egenAr !== null) {
      const efter = konkurrentAr.filter((p) => p.ar > egenAr).length;
      const dem = konkurrentAr.length === 1 ? "it" : "them";
      delar.push(
        efter === 0
          ? `You were registered in ${egenAr}, after all of ${dem}.`
          : efter === konkurrentAr.length
            ? `You were registered in ${egenAr}, before all of ${dem}.`
            : `You were registered in ${egenAr}; ${tal(efter)} of them arrived after you.`,
      );
    }
    return delar.join(" ");
  }

  const text = lasning();

  return (
    <figure className="tryck-hel m-0 flex flex-col gap-5">
      {ritbar ? (
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
            <title>{`Registration year, one row per company, ${minData}–${maxData}`}</title>

            {/* Recessive first: the hover band, then the grid, then the axis, then data. */}
            {daterade.map((p, rad) =>
              hovNamn === p.namn ? (
                <rect
                  key={`band-${p.namn}`}
                  x={0}
                  y={yRad0 + rad * radhojd - radhojd / 2}
                  width={B}
                  height={radhojd}
                  fill="var(--upphojd)"
                />
              ) : null,
            )}

            {ticks.map((t) => (
              <line
                key={`rutnat-${t}`}
                x1={xAv(t)}
                y1={12}
                x2={xAv(t)}
                y2={yBas}
                stroke="var(--linje)"
                strokeWidth="1"
              />
            ))}
            <line x1={x0} y1={yBas} x2={x1} y2={yBas} stroke="var(--linje)" strokeWidth="1" />

            {ticks.map((t) => (
              <text
                key={`tick-${t}`}
                x={xAv(t)}
                y={yBas + 20}
                textAnchor="middle"
                fontSize="12"
                fill="var(--dampad)"
                className="data"
              >
                {t}
              </text>
            ))}
            <text
              x={(x0 + x1) / 2}
              y={yBas + 44}
              textAnchor="middle"
              fontSize="11"
              letterSpacing="1.6"
              fill="var(--dampad)"
            >
              YEAR REGISTERED
            </text>

            {daterade.map((p, rad) => {
              const y = yRad0 + rad * radhojd;
              const x = xAv(p.ar);
              const aktiv = hovNamn === p.namn;
              const farg = p.egen ? "var(--du)" : "var(--amber)";
              return (
                <g key={`entre-${p.namn}`}>
                  <title>{`${p.namn} — registered ${p.ar}`}</title>
                  {/* A leader from the name to its dot. The rows are far apart and the
                      axis is wide; without it the eye loses the row halfway across.
                      The oldest company can sit on the axis start, where there is no
                      distance to lead across and a line would double back. */}
                  {x - 9 > ranna + 10 && (
                    <line
                      x1={ranna + 8}
                      y1={y}
                      x2={x - 9}
                      y2={y}
                      stroke="var(--linje)"
                      strokeWidth="1"
                    />
                  )}
                  <text
                    x={ranna}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="13"
                    fill={p.egen ? "var(--du)" : "var(--black)"}
                    fontWeight={aktiv ? 600 : 400}
                  >
                    {kort(p.namn, 22)}
                  </text>
                  <circle
                    cx={x}
                    cy={y}
                    r={aktiv ? 7 : 5.5}
                    fill={farg}
                    stroke="var(--halo)"
                    strokeWidth="2"
                  />
                  <text
                    x={x + 13}
                    y={y + 4}
                    fontSize="12"
                    fill={p.egen ? "var(--du)" : "var(--dampad)"}
                    className="data"
                  >
                    {p.ar}
                  </text>
                </g>
              );
            })}

            {/* Enlarged hit targets last, so nothing drawn can swallow the pointer. */}
            {daterade.map((p, rad) => (
              <rect
                key={`traff-${p.namn}`}
                x={0}
                y={yRad0 + rad * radhojd - radhojd / 2}
                width={B}
                height={radhojd}
                fill="transparent"
                onMouseEnter={() => sattHovNamn(p.namn)}
                onMouseLeave={() => sattHovNamn(null)}
              />
            ))}
          </svg>
        </div>
      ) : (
        // One dot is not a timeline, and no dots is not a chart. Say the thing.
        <p className="text-[15px] leading-relaxed text-dampad">
          {daterade.length === 1
            ? `Only one company here has a registration date in the register — ${daterade[0].namn}, registered ${daterade[0].ar}. One date is not a timeline.`
            : "None of these companies has a registration date in the Swedish register, so there is no entry timeline to draw. They are foreign companies, branches or sole traders, which is itself worth knowing: this field is not one you can research through Swedish filings."}
        </p>
      )}

      {text && <p className="text-[15px] leading-relaxed text-black">{text}</p>}

      <Etableringstabell
        poster={tabellposter}
        egenAr={egenAr}
        hovNamn={hovNamn}
        sattHovNamn={sattHovNamn}
      />

      <figcaption className="text-[13px] leading-relaxed text-dampad">
        {ritbar
          ? "One row per company, at the year it was registered in the Swedish company register, oldest at the top."
          : "Every company we could read is in the table, with its registration year where the register had one."}
        {ritbar && egenAr !== null ? " Your own company is the row in green." : ""}{" "}
        {ritbar && odaterade.length > 0
          ? `${tal(odaterade.length)} of these ${tal(poster.length)} companies have no registration date on file and cannot be placed on the axis — they are at the foot of the table. `
          : ""}
        Registration is when the legal entity was created, which is not always when the
        product launched: a company can be registered years before it sells anything,
        and a product can be older than the entity that now owns it — an acquisition or
        a restructure resets this date. Read it as when the competitor became a company
        here, not as its founding.
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------------- */

/**
 * Both exhibits, in the order they answer questions: is this market growing,
 * and who has been arriving in it. The caller can also place either half on its
 * own — the two are exported separately.
 */
export default function Sektor({ konkurrenter, egen = null, egetNamn }: Sektorprops) {
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <h2 className="text-[11px] uppercase tracking-[0.16em] text-dampad">
          Sector revenue over time
        </h2>
        <div className="konsolkort p-4 sm:p-5">
          <Sektorintakt konkurrenter={konkurrenter} egen={egen} egetNamn={egetNamn} />
        </div>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-[11px] uppercase tracking-[0.16em] text-dampad">
          When your competitors appeared
        </h2>
        <div className="konsolkort p-4 sm:p-5">
          <Etablering konkurrenter={konkurrenter} egen={egen} egetNamn={egetNamn} />
        </div>
      </section>
    </div>
  );
}
