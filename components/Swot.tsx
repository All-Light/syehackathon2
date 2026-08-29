"use client";

import { useState } from "react";
import type { Kalla, Swot as Swotdata, SwotRuta } from "@/lib/types";

/**
 * The four boxes, per competitor.
 *
 * Every point in here was consolidated in code from a field the research had
 * already filled in — `lib/agent/swot.ts` is the whole of it, and no model runs
 * there. So the grid is typeset to make that checkable rather than to look
 * impressive: each point carries its own source or says it has none, and a box
 * with nothing behind it prints the reason instead of being padded to match its
 * neighbours. An empty quadrant is the most honest thing on the page and is
 * given the same room as a full one.
 *
 * No red-amber-green: these boxes are two vantage points, not two severities.
 * The top row is about the competitor and the bottom row is about the reader,
 * which is the only reading of a competitor SWOT that holds together, so the
 * rows are what the shading separates.
 */

const RUTOR = [
  { nyckel: "styrkor", rubrik: "Strengths", vem: "About them" },
  { nyckel: "svagheter", rubrik: "Weaknesses", vem: "About them" },
  { nyckel: "mojligheter", rubrik: "Opportunities", vem: "For you" },
  { nyckel: "hot", rubrik: "Threats", vem: "For you" },
] as const satisfies readonly { nyckel: keyof Swotdata; rubrik: string; vem: string }[];

const TOM: SwotRuta = { punkter: [], tomtSkal: null };

/**
 * The same disclosure as the rest of the report: folded behind a press on
 * screen, forced open in print by `.kalla-text`, because a folded source is no
 * source at all on paper.
 */
function Kallhanvisning({ kalla }: { kalla: Kalla }) {
  const [oppen, satt] = useState(false);
  return (
    <span className="inline-flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => satt((o) => !o)}
        className="ej-tryck self-start text-[11px] uppercase tracking-[0.12em] text-amber underline-offset-4 hover:underline"
        aria-expanded={oppen}
      >
        {oppen ? "Hide source" : "Show source"}
      </button>
      <span
        className={`kalla-text border-l-2 border-linje pl-3 text-[13px] text-dampad ${
          oppen ? "block" : "hidden"
        }`}
      >
        <span className="block italic">&ldquo;{kalla.citat}&rdquo;</span>
        <a
          href={kalla.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block break-all text-xs text-amber underline-offset-4 hover:underline"
        >
          {kalla.url}
        </a>
      </span>
    </span>
  );
}

function Ruta({
  rubrik,
  vem,
  ruta,
  lag,
}: {
  rubrik: string;
  vem: string;
  ruta: SwotRuta;
  /** The reader's own row, shaded so the change of vantage is visible at a glance. */
  lag: boolean;
}) {
  const punkter = ruta?.punkter ?? [];
  return (
    <div className={`flex flex-col gap-4 p-5 sm:p-6 ${lag ? "bg-papper-djup" : "bg-papper"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h5 className="text-[11px] uppercase tracking-[0.16em] text-black">{rubrik}</h5>
        <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-dampad">{vem}</span>
      </div>

      {punkter.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {punkter.map((p, n) => (
            <li key={`${n}-${p.text.slice(0, 40)}`} className="flex gap-3">
              <span className="mt-[0.62em] h-px w-3 shrink-0 bg-amber" />
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[14px] leading-[1.6] text-black">{p.text}</span>
                {p.kalla ? (
                  <Kallhanvisning kalla={p.kalla} />
                ) : (
                  // Said rather than left blank: the absence of a source is a fact
                  // about the point, and the reader should not have to infer it.
                  <span className="text-[11px] uppercase tracking-[0.12em] text-dampad">
                    No source
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        // Dashed, like the weakest confidence mark elsewhere: this is a stated
        // gap, and it is deliberately not padded out to the size of a full box.
        <p className="border-l-2 border-dashed border-linje pl-3 text-[13px] leading-[1.65] text-dampad">
          {ruta?.tomtSkal ?? "Nothing was recorded for this box."}
        </p>
      )}
    </div>
  );
}

function Grid({ swot }: { swot: Swotdata }) {
  const rutor = RUTOR.map((r) => ({ ...r, data: (swot[r.nyckel] as SwotRuta) ?? TOM }));
  const punkter = rutor.reduce((n, r) => n + (r.data.punkter?.length ?? 0), 0);
  const kallade = rutor.reduce(
    (n, r) => n + (r.data.punkter ?? []).filter((p) => p.kalla).length,
    0,
  );

  return (
    <section className="tryck-hel flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-linje pb-2">
        <h4 className="font-serif text-xl leading-tight text-black sm:text-2xl">
          {swot.konkurrent}
        </h4>
        <span className="text-[11px] uppercase tracking-[0.12em] text-dampad">
          {punkter === 0
            ? "Nothing consolidated"
            : `${punkter} ${punkter === 1 ? "point" : "points"} · ${kallade} with a source`}
        </span>
      </div>

      {/* Hairlines by gap rather than by borders, so no rule doubles at a seam. */}
      <div className="grid gap-px border border-linje bg-linje sm:grid-cols-2">
        {rutor.map((r, n) => (
          <Ruta key={r.nyckel} rubrik={r.rubrik} vem={r.vem} ruta={r.data} lag={n >= 2} />
        ))}
      </div>
    </section>
  );
}

export default function Swot({ swot }: { swot?: Swotdata[] | null }) {
  // Reports stored before this exhibit existed carry no `swot` at all, so the
  // field is treated as absent whatever the type promises.
  if (!swot?.length) return null;

  return (
    <figure className="m-0 flex flex-col gap-10">
      {swot.map((s, n) => (
        <Grid key={`${n}-${s?.konkurrent ?? ""}`} swot={s} />
      ))}

      <figcaption className="text-[13px] leading-relaxed text-dampad">
        Nothing in these grids was written for them. Every point is carried across from
        something the research had already established — where a competitor is ahead of
        us or behind us, what their customers said, the moves the deep dive proposed —
        or computed from the published prices and filed accounts printed elsewhere in
        this report. Strengths and weaknesses are stated about the competitor;
        opportunities and threats from your side, which is the only reading of the four
        boxes that holds together. A box with nothing behind it says why instead of being
        filled, and a company we could not match in the Swedish company register is never
        marked down for it — a foreign parent, a branch or a sole trader files nothing
        here, which is not the same thing as having no weaknesses or no size.
      </figcaption>
    </figure>
  );
}
