"use client";

import { useRef, useState } from "react";
import Arbetsvy, { type Kandidat } from "@/components/Arbetsvy";
import Rapportvy from "@/components/Rapportvy";
import type { Handelse, Rapport } from "@/lib/types";

type Fas = "start" | "arbetar" | "klar";

/**
 * The run's id, first thing on the stream. Deliberately not part of `Handelse`
 * yet — that union lives in lib/types.ts, which is being edited elsewhere — so
 * the client recognises the event by its shape instead of by its type.
 */
type Korningshandelse = { typ: "korning"; id: string };

/**
 * The headline's last word, cycled. Each one is a column the report genuinely
 * fills in — published prices, the positioning line, the feature scope, the
 * weaknesses you can attack, the filed revenue — so the hero states the
 * coverage instead of a feature list nobody scrolls to.
 */
const SLUTORD = ["charge", "promise", "ship", "miss", "earn"];

/** Seconds each word holds the slot. The loop is this times the word count. */
const VAXELTID = 2.6;

function arKorning(h: unknown): h is Korningshandelse {
  if (typeof h !== "object" || h === null) return false;
  const k = h as { typ?: unknown; id?: unknown };
  return k.typ === "korning" && typeof k.id === "string";
}

export default function Sida() {
  const [fas, sattFas] = useState<Fas>("start");
  const [url, sattUrl] = useState("");
  const [rader, sattRader] = useState<string[]>([]);
  const [kandidater, sattKandidater] = useState<Kandidat[]>([]);
  const [foretag, sattForetag] = useState<string | null>(null);
  const [rapport, sattRapport] = useState<Rapport | null>(null);
  const [rapportId, sattRapportId] = useState<string | null>(null);
  const [fel, sattFel] = useState<string | null>(null);
  const avbryt = useRef<AbortController | null>(null);

  async function starta(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    sattFas("arbetar");
    sattFel(null);
    sattRader([]);
    sattKandidater([]);
    sattForetag(null);
    // A second analysis from a page still showing /r/<previous> would otherwise
    // sit under an address that describes someone else's run.
    window.history.replaceState(null, "", "/");

    avbryt.current?.abort();
    const styr = new AbortController();
    avbryt.current = styr;

    try {
      const svar = await fetch("/api/analys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
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
          const h: unknown = JSON.parse(rad.slice(6));
          if (arKorning(h)) {
            sattRapportId(h.id);
            // replaceState, not the router: a navigation unmounts this
            // component and aborts the fetch that is producing the run.
            window.history.replaceState(null, "", `/r/${h.id}`);
            continue;
          }
          hantera(h as Handelse);
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      sattFel(e instanceof Error ? e.message : "Something went wrong.");
      sattFas("start");
    }
  }

  function hantera(h: Handelse) {
    switch (h.typ) {
      case "steg":
        sattRader((r) => [...r, h.text]);
        break;
      case "profil":
        sattForetag(h.egen.namn);
        break;
      case "kandidat":
        sattKandidater((k) =>
          k.some((x) => x.url === h.url) ? k : [...k, { namn: h.namn, url: h.url, klar: false }],
        );
        break;
      case "konkurrent":
        sattKandidater((k) =>
          k.map((x) => (x.url === h.konkurrent.url ? { ...x, klar: true } : x)),
        );
        break;
      case "klar":
        sattRapport(h.rapport);
        sattRapportId(h.id);
        sattFas("klar");
        break;
      case "fel":
        sattFel(h.text);
        sattFas("start");
        break;
    }
  }

  if (fas === "klar" && rapport) {
    return (
      <main className="min-h-dvh bg-papper">
        <Rapportvy rapport={rapport} id={rapportId} />
      </main>
    );
  }

  if (fas === "arbetar") {
    return (
      <main className="min-h-dvh bg-papper">
        <Arbetsvy rader={rader} kandidater={kandidater} foretag={foretag} />
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center bg-papper">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-16">
        <div className="flex flex-col gap-5">
          <span className="text-[11px] uppercase tracking-[0.16em] text-dampad">Sweep</span>
          <h1 className="font-serif text-5xl leading-[1.08] text-black sm:text-6xl">
            Know what your competitors{" "}
            {/* Amber marks the part of the sentence that varies, the same way
                Arbetsvy marks the company name it just read. The words are
                stacked in one inline-grid cell, so the box is already as wide
                as the longest of them and the line cannot jump as they swap;
                the full stop travels with each word so it never drifts. */}
            <em className="vaxelord inline-grid not-italic text-amber">
              {SLUTORD.map((ord, i) => (
                <span
                  key={ord}
                  // The first word is the real sentence for a screen reader,
                  // which has no way to watch the rest take their turn.
                  aria-hidden={i > 0}
                  className="col-start-1 row-start-1"
                  // Base state, not the animation: what a reduced-motion
                  // reader is left with once the animation is switched off.
                  style={{
                    opacity: i === 0 ? 1 : 0,
                    animation: `vaxelord ${SLUTORD.length * VAXELTID}s ease-in-out ${(
                      i * VAXELTID
                    ).toFixed(2)}s infinite`,
                  }}
                >
                  {ord}
                  <span className="text-black">.</span>
                </span>
              ))}
            </em>
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-dampad">
            Paste your website. The agent works out who you actually compete with —
            including the ones you have never heard of — reads their pages and tells
            you what to do about it.
          </p>
        </div>

        <form onSubmit={starta} className="flex flex-col gap-3">
          <label htmlFor="url" className="text-[11px] uppercase tracking-[0.16em] text-dampad">
            Your website
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="url"
              type="text"
              inputMode="url"
              autoComplete="url"
              value={url}
              onChange={(e) => sattUrl(e.target.value)}
              placeholder="yourcompany.com"
              className="flex-1 border border-linje bg-transparent px-4 py-3 text-black placeholder:text-dampad/60 focus:border-amber focus:outline-none"
            />
            <button
              type="submit"
              className="bg-black px-6 py-3 text-papper transition-colors hover:bg-amber disabled:opacity-40"
              disabled={!url.trim()}
            >
              Analyse
            </button>
          </div>
          {fel && <p className="text-sm text-rod">{fel}</p>}
          <p className="text-sm text-dampad">Takes about two minutes. No sign-up.</p>
        </form>
      </div>
    </main>
  );
}
