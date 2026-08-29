"use client";

import { useEffect, useRef, useState } from "react";

type Lage = "vila" | "hamtar" | "spelar" | "pausad";

/**
 * The report read aloud. Sits in the report footer next to "Check now".
 *
 * The clip is kept in a ref after the first fetch: re-synthesising costs
 * ElevenLabs characters and three seconds, and people replay a briefing.
 */
export default function Lyssna({ id }: { id: string }) {
  const [lage, sattLage] = useState<Lage>("vila");
  const [fel, sattFel] = useState<string | null>(null);
  // Mirrors ljudRef for the label, because a ref cannot be read during render.
  const [klar, sattKlar] = useState(false);
  const ljudRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      ljudRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  async function vaxla() {
    if (lage === "hamtar") return;

    const ljud = ljudRef.current;
    if (ljud) {
      if (lage === "spelar") {
        ljud.pause();
        sattLage("pausad");
      } else {
        if (lage === "vila") ljud.currentTime = 0;
        void ljud.play();
        sattLage("spelar");
      }
      return;
    }

    sattFel(null);
    sattLage("hamtar");
    try {
      const svar = await fetch("/api/rost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!svar.ok) {
        const data = (await svar.json().catch(() => null)) as { fel?: string } | null;
        throw new Error(data?.fel ?? "The briefing could not be recorded.");
      }

      const url = URL.createObjectURL(await svar.blob());
      urlRef.current = url;
      const nytt = new Audio(url);
      nytt.onended = () => sattLage("vila");
      nytt.onerror = () => {
        sattFel("The briefing could not be played.");
        sattLage("vila");
      };
      ljudRef.current = nytt;
      sattKlar(true);
      await nytt.play();
      sattLage("spelar");
    } catch (e) {
      sattFel(e instanceof Error ? e.message : "The briefing could not be recorded.");
      sattLage("vila");
    }
  }

  function stoppa() {
    const ljud = ljudRef.current;
    if (!ljud) return;
    ljud.pause();
    ljud.currentTime = 0;
    sattLage("vila");
  }

  const etikett =
    lage === "hamtar"
      ? "Recording the briefing…"
      : lage === "spelar"
        ? "Pause"
        : lage === "pausad"
          ? "Resume"
          : klar
            ? "Play it again"
            : "Listen — 60 seconds";

  return (
    <span className="inline-flex flex-col gap-1.5">
      <span className="inline-flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={vaxla}
          disabled={lage === "hamtar"}
          className="border border-linje px-5 py-2.5 text-sm text-dampad hover:border-black hover:text-black disabled:opacity-50"
        >
          {etikett}
        </button>
        {(lage === "spelar" || lage === "pausad") && (
          <button
            type="button"
            onClick={stoppa}
            className="text-[11px] uppercase tracking-[0.12em] text-amber underline-offset-4 hover:underline"
          >
            Stop
          </button>
        )}
      </span>
      {fel && <span className="text-sm text-rod">{fel}</span>}
    </span>
  );
}
