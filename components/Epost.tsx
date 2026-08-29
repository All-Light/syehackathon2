"use client";

import { useId, useState } from "react";

/**
 * Attaches an email address to a report.
 *
 * The customer has no account — this url is their only copy of two minutes of
 * work — so the honest offer is a way back to it, not a newsletter. Nothing is
 * sent from this product, so nothing here may suggest that something will be:
 * the copy says where the address goes and stops.
 */
export default function Epost({ id, epost }: { id: string; epost?: string | null }) {
  const faltId = useId();
  const [sparad, sattSparad] = useState<string | null>(epost ?? null);
  // A returning customer sees what they already left, not an empty field they
  // have to fill in a second time to find out it was already there.
  const [redigerar, sattRedigerar] = useState(!epost);
  const [varde, sattVarde] = useState("");
  const [laddar, sattLaddar] = useState(false);
  const [fel, sattFel] = useState<string | null>(null);

  async function skicka(e: React.FormEvent) {
    e.preventDefault();
    if (laddar || !varde.trim()) return;
    sattLaddar(true);
    sattFel(null);
    try {
      const svar = await fetch("/api/epost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, epost: varde }),
      });
      const data = (await svar.json()) as { ok?: boolean; epost?: string; fel?: string };
      if (!svar.ok || !data.ok || !data.epost) {
        throw new Error(data.fel ?? "Could not save that address.");
      }
      // Show what the server actually stored, normalised, rather than what was
      // typed: the two differ, and the stored one is the truth.
      sattSparad(data.epost);
      sattRedigerar(false);
      sattVarde("");
    } catch (e) {
      sattFel(e instanceof Error ? e.message : "Could not save that address.");
    } finally {
      sattLaddar(false);
    }
  }

  if (sparad && !redigerar) {
    return (
      <section className="ej-tryck flex flex-col gap-2 border-t border-linje pt-8">
        <p className="text-[15px] text-black">
          <span className="text-dampad">Attached to this report: </span>
          {sparad}
        </p>
        <p className="text-sm text-dampad">
          Stored with the report. Nothing is sent — it is here so this work can be found
          again if the link goes missing.
        </p>
        <button
          type="button"
          onClick={() => {
            sattRedigerar(true);
            sattVarde(sparad);
            sattFel(null);
          }}
          className="self-start text-sm text-amber underline-offset-4 transition-colors hover:text-black hover:underline"
        >
          Use a different address
        </button>
      </section>
    );
  }

  return (
    <section className="ej-tryck flex flex-col gap-4 border-t border-linje pt-8">
      <div className="flex flex-col gap-2">
        <h2 className="font-serif text-2xl text-black">Keep a way back to this report.</h2>
        <p className="max-w-lg text-[15px] text-dampad">
          There is no sign-up, so this link is your only copy. Leave your address and it is
          stored with the report — nothing is sent.
        </p>
      </div>
      <form onSubmit={skicka} className="flex flex-col gap-3">
        <label
          htmlFor={faltId}
          className="text-[11px] uppercase tracking-[0.16em] text-dampad"
        >
          Your email
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id={faltId}
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={varde}
            onChange={(e) => sattVarde(e.target.value)}
            placeholder="you@company.com"
            className="flex-1 border border-linje bg-transparent px-4 py-3 text-black placeholder:text-dampad/60 focus:border-amber focus:outline-none sm:max-w-sm"
          />
          <button
            type="submit"
            disabled={laddar || !varde.trim()}
            className="bg-amber px-5 py-2.5 text-sm text-papper transition-colors hover:bg-black disabled:opacity-50"
          >
            {laddar ? "Saving…" : "Attach to this report"}
          </button>
        </div>
        {fel && <p className="text-sm text-rod">{fel}</p>}
      </form>
    </section>
  );
}
