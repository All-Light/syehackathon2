"use client";

import { useState } from "react";
import Epost from "@/components/Epost";
import Falt from "@/components/Falt";
import { belopp } from "@/lib/diagram";
import { byggKrok } from "@/lib/krok";
import type { Forandring, Konkurrent, Rapport } from "@/lib/types";

/** Filed accounts are the only real time series we hold. Only what files appears. */
function serier(rapport: Rapport) {
  const av = (k: Konkurrent) => ({
    konkurrent: k.namn,
    serie: (k.orgdata?.historik ?? []).filter((h) => h.omsattningTkr !== null),
  });
  return {
    konkurrenter: rapport.konkurrenter.map(av).filter((s) => s.serie.length >= 2),
    egen: rapport.egen_djup ? av(rapport.egen_djup) : null,
  };
}

/** Group by day so a burst of checks reads as one event, not eight. */
function perDag(forandringar: Forandring[]) {
  const dagar = new Map<string, Forandring[]>();
  for (const f of forandringar) {
    const dag = f.upptackt.slice(0, 10);
    dagar.set(dag, [...(dagar.get(dag) ?? []), f]);
  }
  return [...dagar.entries()];
}

function Stat({ etikett, varde }: { etikett: string; varde: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] uppercase tracking-[0.12em] text-dampad">{etikett}</dt>
      <dd className="siffror text-lg text-black">{varde}</dd>
    </div>
  );
}

export default function Bevakningsvy({
  id,
  rapport,
  bevakas,
  forandringar,
  skapad,
  epost,
}: {
  id: string;
  rapport: Rapport;
  bevakas: boolean;
  forandringar: Forandring[];
  skapad: string;
  epost?: string | null;
}) {
  const [rader, sattRader] = useState<Forandring[]>(forandringar);
  const [kollar, sattKollar] = useState(false);
  const [kontrollerad, sattKontrollerad] = useState(false);

  const { konkurrenter, egen } = serier(rapport);
  const krok = byggKrok(rapport);
  const sidor = rapport.konkurrenter.reduce((n, k) => n + k.sidor.length, 0);
  const senast = rapport.konkurrenter
    .flatMap((k) => k.sidor.map((s) => s.hamtad))
    .sort()
    .at(-1);


  async function koraKontroll() {
    if (kollar) return;
    sattKollar(true);
    try {
      const svar = await fetch("/api/kontroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await svar.json()) as { forandringar?: Forandring[] };
      if (data.forandringar?.length) sattRader((r) => [...data.forandringar!, ...r]);
      sattKontrollerad(true);
    } catch {
      sattKontrollerad(true);
    } finally {
      sattKollar(false);
    }
  }

  return (
    <div className="flex flex-col">
      {/* The hook is the fact, not the surface. One number, big enough to read
          from across a room, and a sentence that says why it matters. Paper,
          not a dark band: a background cannot hook anyone, and pretending it
          can is how every AI product ends up looking the same. */}
      <section className="border-b border-linje bg-papper-djup/40">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
          <div className="flex flex-col gap-4">
            <span className="text-[11px] uppercase tracking-[0.16em] text-dampad">
              {rapport.egen.namn} · the field
            </span>
            <p className="flex flex-col gap-3">
              <span className="siffror font-serif text-[clamp(3.5rem,13vw,7rem)] leading-[0.9] text-amber">
                {krok.tal}
              </span>
              <span className="max-w-xl font-serif text-2xl leading-snug text-black sm:text-[28px]">
                {krok.text}
              </span>
            </p>
            {krok.kalla && (
              <a
                href={krok.kalla}
                target="_blank"
                rel="noopener noreferrer"
                className="ej-tryck self-start text-[11px] uppercase tracking-[0.12em] text-amber underline-offset-4 hover:underline"
              >
                Filed accounts
              </a>
            )}
          </div>

          <Falt konkurrenter={konkurrenter} egen={egen} egetNamn={rapport.egen.namn} />
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-14 px-6 py-14">
        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-dampad">
              What has moved
            </h2>
            <button
              type="button"
              onClick={koraKontroll}
              disabled={kollar}
              className="ej-tryck border border-linje px-4 py-2 text-sm text-dampad transition-colors hover:border-black hover:text-black disabled:opacity-50"
            >
              {kollar ? "Re-reading their pages…" : "Check now"}
            </button>
          </div>

          {rader.length === 0 ? (
            // An empty feed is the common case and deserves a real sentence.
            <p className="max-w-lg text-[15px] leading-relaxed text-dampad">
              Nothing has moved since we last looked. We watch{" "}
              <span className="siffror text-black">{sidor}</span> pages across{" "}
              <span className="siffror text-black">{rapport.konkurrenter.length}</span>{" "}
              competitors
              {senast ? <> — last read {senast.slice(0, 10)}</> : null}.
              {kontrollerad ? " Just checked again: still nothing." : null}
            </p>
          ) : (
            <ol className="flex flex-col gap-6">
              {perDag(rader).map(([dag, poster]) => (
                <li key={dag} className="flex flex-col gap-2">
                  <span className="siffror text-[11px] uppercase tracking-[0.12em] text-dampad">
                    {dag}
                  </span>
                  <ul className="flex flex-col divide-y divide-linje border-y border-linje">
                    {poster.map((f, n) => (
                      <li
                        key={`${f.url}-${n}`}
                        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3"
                        style={{ animation: "stig 0.4s ease-out both" }}
                      >
                        <span className="text-black">{f.konkurrent}</span>
                        <span className="text-[15px] text-dampad">{f.vad}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-[11px] uppercase tracking-[0.16em] text-dampad">
            Where you stand
          </h2>
          <dl className="flex flex-wrap gap-x-10 gap-y-5 border-y border-linje py-5">
            <Stat etikett="Competitors read" varde={String(rapport.konkurrenter.length)} />
            <Stat etikett="Pages watched" varde={String(sidor)} />
            <Stat
              etikett="Filing accounts"
              varde={String(konkurrenter.length)}
            />
            <Stat
              etikett="Largest of them"
              varde={
                konkurrenter
                  .map((s) => s.serie[0]?.omsattningTkr ?? 0)
                  .sort((a, b) => b - a)[0]
                  ? belopp(
                      konkurrenter
                        .map((s) => s.serie[0]?.omsattningTkr ?? 0)
                        .sort((a, b) => b - a)[0],
                    )
                  : "—"
              }
            />
            <Stat etikett="Analysed" varde={skapad.slice(0, 10)} />
          </dl>
          <p className="text-sm text-dampad">
            {bevakas
              ? "Watching — changes show up here."
              : "Not watching yet. Turn it on from the summary to keep this page fed."}
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-[11px] uppercase tracking-[0.16em] text-dampad">
            What to do
          </h2>
          <ol className="flex flex-col gap-4">
            {rapport.atgarder.map((a, n) => (
              <li key={a} className="flex gap-4">
                <span className="siffror pt-0.5 text-sm text-amber">{n + 1}</span>
                <span className="text-lg leading-snug text-black">{a}</span>
              </li>
            ))}
          </ol>
        </section>

        <Epost id={id} epost={epost} />
      </div>
    </div>
  );
}
