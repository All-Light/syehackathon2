"use client";

import { useState } from "react";
import type { Plan } from "@/lib/stripe";

export default function Betala({ id, betald }: { id: string; betald: boolean }) {
  const [laddar, sattLaddar] = useState<Plan | null>(null);
  const [fel, sattFel] = useState<string | null>(null);

  async function koraCheckout(plan: Plan) {
    if (laddar) return;
    sattLaddar(plan);
    sattFel(null);
    try {
      const svar = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, plan }),
      });
      const data = (await svar.json()) as { url?: string; fel?: string };
      if (!data.url) throw new Error(data.fel ?? "Could not start checkout.");
      location.href = data.url;
    } catch {
      // The redirect never happens on failure, so the button must come back.
      sattFel("Could not open checkout. Please try again.");
      sattLaddar(null);
    }
  }

  if (betald) {
    return (
      <p className="border-t border-linje pt-8 text-sm text-dampad">
        Paid — thank you. This report is yours to keep.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-linje pt-8">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => koraCheckout("rapport")}
          disabled={laddar !== null}
          className="bg-amber px-5 py-2.5 text-sm text-papper transition-colors hover:bg-black disabled:opacity-50"
        >
          {laddar === "rapport" ? "Opening checkout…" : "Buy this report — 490 SEK"}
        </button>
        <button
          type="button"
          onClick={() => koraCheckout("bevakning")}
          disabled={laddar !== null}
          className="border border-black px-5 py-2.5 text-sm text-black transition-colors hover:bg-black hover:text-papper disabled:opacity-50"
        >
          {laddar === "bevakning" ? "Opening checkout…" : "Add monitoring — 290 SEK / month"}
        </button>
      </div>
      {fel && <p className="text-sm text-rod">{fel}</p>}
    </div>
  );
}
