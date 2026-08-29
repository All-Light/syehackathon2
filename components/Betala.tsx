"use client";

import { useState } from "react";
import { kopAktivt, ORDINARIE_RAPPORT, PRISER, type Plan } from "@/lib/stripe";

const kr = (öre: number) => (öre / 100).toLocaleString("sv-SE");

export default function Betala({ id, betald }: { id: string; betald: boolean }) {
  const [laddar, sattLaddar] = useState<Plan | null>(null);
  const [fel, sattFel] = useState<string | null>(null);
  const oppet = kopAktivt();

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
        Paid — thank you. The full report is below, and this link keeps working.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 border-t border-linje pt-8">
      <div className="flex flex-col gap-2">
        <h2 className="font-serif text-2xl text-black">
          What you have read so far is the summary.
        </h2>
        {/* A price with no idea of what it buys reads as a paywall. Say what
            arrives, in the order a buyer cares about it. */}
        <ul className="flex flex-col gap-1.5 text-[15px] text-dampad">
          <li>
            Five researchers on <em className="not-italic text-black">each</em> competitor —
            business model, product, who they sell to, what customers say, company filings.
          </li>
          <li>
            The argument written out: where the money is in this market, who can do what,
            and who is actually growing.
          </li>
          <li>Every claim labelled Verified, Derived or Judgement, with its source.</li>
          <li>A PDF you can file or send to your accountant.</li>
        </ul>
        <p className="flex flex-wrap items-baseline gap-2 pt-1">
          <span className="rounded-full bg-amber/12 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-amber">
            Early bird
          </span>
          <span className="siffror text-2xl text-black">{kr(PRISER.rapport.belopp)} kr</span>
          <span className="siffror text-sm text-dampad line-through">
            {kr(ORDINARIE_RAPPORT)} kr
          </span>
          <span className="text-sm text-dampad">for the first customers</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => koraCheckout("rapport")}
          disabled={laddar !== null || !oppet}
          className="bg-amber px-5 py-2.5 text-sm text-papper transition-colors hover:bg-black disabled:opacity-50"
        >
          {laddar === "rapport"
            ? "Opening checkout…"
            : `Buy the full report — ${kr(PRISER.rapport.belopp)} kr`}
        </button>
        <button
          type="button"
          onClick={() => koraCheckout("bevakning")}
          disabled={laddar !== null || !oppet}
          className="border border-black px-5 py-2.5 text-sm text-black transition-colors hover:bg-black hover:text-papper disabled:opacity-50"
        >
          {laddar === "bevakning"
            ? "Opening checkout…"
            : `Add monitoring — ${kr(PRISER.bevakning.belopp)} kr / month`}
        </button>
      </div>
      {!oppet && (
        <p className="text-sm text-dampad">
          Not on sale yet — we are still talking to the first few customers by hand.
        </p>
      )}
      {fel && <p className="text-sm text-rod">{fel}</p>}
    </div>
  );
}
