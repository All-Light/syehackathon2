"use client";

import { useEffect, useRef } from "react";

export type Kandidat = { namn: string; url: string; klar: boolean };

/**
 * The working mark, shared by every view that runs one of these jobs — a scale
 * of the set being read, one tick per source, filled as each one comes back.
 *
 * It lives here because this is the view that owns the wait; the deep dive and
 * the full report import it so the three screens speak with one mark rather
 * than three. `klara` is a count, not a set: the scale says how much of the
 * work is in, and the chips or rows underneath say which.
 */
export function Svep({ totalt, klara }: { totalt: number; klara: number }) {
  return (
    // Decorative: the label beside it already states the same progress in words.
    <span className="svep" aria-hidden="true">
      {Array.from({ length: totalt }, (_, i) => (
        <span
          key={i}
          className={`svep-tand${i < klara ? " svep-tand-klar" : ""}`}
        />
      ))}
      <span className="svep-huvud" />
    </span>
  );
}

/**
 * The wait is the proof. Every line here is a decision the agent actually made,
 * so the ninety seconds read as work rather than as a spinner.
 */
export default function Arbetsvy({
  rader,
  kandidater,
  foretag,
}: {
  rader: string[];
  kandidater: Kandidat[];
  foretag: string | null;
}) {
  const slut = useRef<HTMLDivElement>(null);

  useEffect(() => {
    slut.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [rader.length]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-10 px-6 py-16">
      <div className="flex flex-col gap-3">
        <span className="flex items-center gap-2.5 text-[11px] uppercase tracking-[0.16em] text-dampad">
          <Svep
            totalt={kandidater.length}
            klara={kandidater.filter((k) => k.klar).length}
          />
          Working
        </span>
        <h1 className="font-serif text-4xl leading-tight text-black sm:text-5xl">
          {foretag ? (
            <>
              Working out who <em className="not-italic text-amber">{foretag}</em>{" "}
              actually competes with
            </>
          ) : (
            "Reading your website"
          )}
        </h1>
      </div>

      {kandidater.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {kandidater.map((k) => (
            <li
              key={k.url}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors duration-500 ${
                k.klar
                  ? "border-linje bg-papper-djup text-black"
                  : "border-linje/70 bg-transparent text-dampad"
              }`}
            >
              {/* Same tick as on the scale above, so a chip and its mark on the
                  rule are recognisably the same thing. */}
              <span className={`svep-tand${k.klar ? " svep-tand-klar" : ""}`} />
              {k.namn}
            </li>
          ))}
        </ul>
      )}

      <div className="flex max-h-64 flex-col gap-1.5 overflow-hidden">
        {rader.slice(-9).map((r, i, alla) => (
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
        <div ref={slut} />
      </div>
    </div>
  );
}
