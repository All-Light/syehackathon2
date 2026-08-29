"use client";

import { useEffect, useState } from "react";

export type Tema = "natt" | "papper";

/**
 * In production this is a build-time constant, so the switch and everything it
 * touches — the effect, the cookie write, the markup — compiles away.
 */
const UTVECKLING = process.env.NODE_ENV !== "production";

/**
 * Two worlds, one switch. Development only.
 *
 * The dashboard was rebuilt in the night console while the report and the
 * landing page are still paper, so the owner needs to put the two side by side
 * without a rebuild. Every colour of the night world lives in one
 * `[data-tema="natt"]` block, which makes the switch a single attribute on
 * <html> — flipping it repaints the page with no re-render and no reload.
 *
 * The initial value comes down from the server, which read it off the cookie,
 * so this button's first render agrees with the markup around it. The attribute
 * and the cookie are then written from an effect: it is a DOM write outside
 * React's tree either way, and putting it in an effect keeps it out of the
 * render path and off the hands of an event handler that should only be
 * setting state.
 */
export default function Temavaljare({ tema }: { tema: Tema }) {
  const [valt, sattValt] = useState<Tema>(tema);

  useEffect(() => {
    if (!UTVECKLING) return;
    document.documentElement.dataset.tema = valt;
    // A year, root path: the choice should survive a reload and every route.
    document.cookie = `tema=${valt}; path=/; max-age=31536000; samesite=lax`;
  }, [valt]);

  if (!UTVECKLING) return null;

  return (
    <div className="ej-tryck fixed right-4 bottom-4 z-50 flex items-center gap-0.5 rounded-full border border-harlinje-stark bg-kort p-0.5">
      {(["natt", "papper"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => sattValt(t)}
          aria-pressed={valt === t}
          className={`rounded-full px-3 py-1 text-[11px] tracking-[0.08em] uppercase transition-colors ${
            valt === t ? "bg-amber text-papper" : "text-dampad hover:text-black"
          }`}
        >
          {t === "natt" ? "Night" : "Paper"}
        </button>
      ))}
    </div>
  );
}
