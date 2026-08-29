"use client";

import { useEffect, useRef } from "react";

export type Kandidat = { namn: string; url: string; klar: boolean };

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
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber" />
          </span>
          Arbetar
        </span>
        <h1 className="font-serif text-4xl leading-tight text-black sm:text-5xl">
          {foretag ? (
            <>
              Letar reda på vilka <em className="not-italic text-amber">{foretag}</em>{" "}
              faktiskt konkurrerar med
            </>
          ) : (
            "Läser din webbplats"
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
              <span
                className={`h-1.5 w-1.5 rounded-full ${k.klar ? "bg-amber" : "bg-linje"}`}
              />
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
