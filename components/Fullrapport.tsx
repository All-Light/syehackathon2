"use client";

import { useEffect, useRef, useState } from "react";
// Aliased because the component below owns the name `Fullrapport` in this module.
import type {
  Avsnitt,
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
  return v.toLocaleString("en-GB", { maximumFractionDigits: 1 });
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
  befintlig,
  kanKopa,
}: {
  id: string;
  befintlig?: Fulldata | null;
  kanKopa: boolean;
}) {
  const [arbetar, sattArbetar] = useState(false);
  const [rader, sattRader] = useState<string[]>([]);
  const [avsnitt, sattAvsnitt] = useState<Avsnitt[]>([]);
  const [full, sattFull] = useState<Fulldata | null>(null);
  const [fel, sattFel] = useState<string | null>(null);
  const [sekunder, sattSekunder] = useState(0);
  const avbryt = useRef<AbortController | null>(null);

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

  async function starta() {
    if (arbetar) return;
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

  if (visad && !arbetar) return <Rapport full={visad} />;

  if (arbetar) {
    return (
      <section className="ej-tryck flex flex-col gap-10 border-t border-linje pt-12">
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2.5 text-[11px] uppercase tracking-[0.16em] text-dampad">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber" />
            </span>
            {avsnitt.length === 0
              ? "Reading the evidence again"
              : `${avsnitt.length} ${avsnitt.length === 1 ? "argument" : "arguments"} written`}
            <span className="siffror text-dampad"> · {sekunder}s</span>
          </span>
          <h2 className="font-serif text-3xl leading-tight text-black sm:text-4xl">
            The full report is being written
          </h2>
          <p className="max-w-lg text-[15px] leading-relaxed text-dampad">
            It reads every source again, decides what the answer is, and then argues for
            it — one section at a time, each one landing here as it is finished. Two to
            four minutes. You can leave this open.
          </p>
        </div>

        {avsnitt.length > 0 && (
          <div className="flex flex-col gap-12 border-t border-linje pt-10">
            {avsnitt.map((a, n) => (
              <div key={`${n}-${a.rubrik}`} style={{ animation: "stig 0.4s ease-out both" }}>
                <Avsnittsvy avsnitt={a} nummer={n + 1} />
              </div>
            ))}
          </div>
        )}

        {rader.length > 0 && (
          <div className="flex flex-col gap-1.5 overflow-hidden">
            {rader.slice(-6).map((r, i, alla) => (
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
        onClick={starta}
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
