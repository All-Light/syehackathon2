"use client";

import { useState } from "react";
import Epost from "@/components/Epost";
import Falt from "@/components/Falt";
import Sektor from "@/components/Sektor";
import { belopp } from "@/lib/diagram";
import { byggKrok } from "@/lib/krok";
import type { Forandring, Konkurrent, Rapport, SidTyp } from "@/lib/types";

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

/**
 * What kind of page moved, in the console's semantic palette.
 *
 * The feed already carried this — every row knows which page it came off — and
 * on paper it stayed invisible because that world spends no hue on meaning. On
 * this ground it can: a price move is the one that costs money this quarter, so
 * it takes the severity colour, and the rest rank below it. The word is set in
 * mono beside the mark, because a colour with no key is decoration.
 */
const SIDTYP: Record<SidTyp, { etikett: string; farg: string }> = {
  pris: { etikett: "Pricing", farg: "text-hog" },
  produkt: { etikett: "Product", farg: "text-bla" },
  nyheter: { etikett: "News", farg: "text-gul" },
  om: { etikett: "About", farg: "text-orange" },
  annat: { etikett: "Other", farg: "text-dampad" },
};

/** A metric tile: their spec, one label over one mono number, on its own card. */
function Stat({ etikett, varde }: { etikett: string; varde: string }) {
  return (
    <div className="konsolkort flex flex-col gap-2 p-4">
      <dt className="text-[11px] uppercase tracking-[0.12em] text-dampad">{etikett}</dt>
      <dd className="data text-[22px] leading-none font-semibold text-black">{varde}</dd>
    </div>
  );
}

/** Section heading. One label face across the whole console. */
function Avdelning({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] uppercase tracking-[0.16em] text-dampad">{children}</h2>
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
          from across a room, and a sentence that says why it matters. The one
          wash on the page sits behind it — their world admits light exactly
          once per view, at the top of the thing it wants you to look at. */}
      <section className="glod border-b border-harlinje">
        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-8 px-4 py-14 sm:px-6 sm:py-16">
          <div className="flex flex-col gap-4">
            <span className="text-[11px] uppercase tracking-[0.16em] text-dampad">
              {rapport.egen.namn} · the field
            </span>
            <p className="flex flex-col gap-4">
              <span className="data text-[clamp(3rem,10vw,3.75rem)] leading-[0.95] font-bold tracking-[-0.02em] text-amber">
                {krok.tal}
              </span>
              <span className="rubrik max-w-2xl text-[clamp(1.25rem,3vw,1.625rem)] leading-[1.25]">
                {krok.text}
              </span>
            </p>
            {krok.kalla && (
              <a
                href={krok.kalla}
                target="_blank"
                rel="noopener noreferrer"
                className="ej-tryck self-start rounded-lg border border-harlinje-stark px-3 py-1.5 text-[12.5px] font-medium text-black transition-colors hover:border-dampad"
              >
                Filed accounts
              </a>
            )}
          </div>

          <div className="konsolkort p-4 sm:p-5">
            <Falt konkurrenter={konkurrenter} egen={egen} egetNamn={rapport.egen.namn} />
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-12 px-4 py-12 sm:px-6 sm:py-14">
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Avdelning>What has moved</Avdelning>
            <button
              type="button"
              onClick={koraKontroll}
              disabled={kollar}
              className={`ej-tryck rounded-xl border border-harlinje-stark px-4 py-2 text-[13px] font-medium text-black transition-colors hover:border-dampad disabled:opacity-60 ${
                kollar ? "sveplinje" : ""
              }`}
            >
              {kollar ? "Re-reading their pages…" : "Check now"}
            </button>
          </div>

          {rader.length === 0 ? (
            // An empty feed is the common case and deserves a real sentence.
            <div className="konsolkort p-5">
              <p className="max-w-lg text-[15px] leading-relaxed text-kropp">
                Nothing has moved since we last looked. We watch{" "}
                <span className="data text-black">{sidor}</span> pages across{" "}
                <span className="data text-black">{rapport.konkurrenter.length}</span>{" "}
                competitors
                {senast ? (
                  <>
                    {" "}
                    — last read <span className="data">{senast.slice(0, 10)}</span>
                  </>
                ) : null}
                .{kontrollerad ? " Just checked again: still nothing." : null}
              </p>
            </div>
          ) : (
            <ol className="flex flex-col gap-4">
              {perDag(rader).map(([dag, poster]) => (
                <li key={dag} className="flex flex-col gap-2">
                  <span className="data text-[11px] tracking-[0.06em] text-dampad">
                    {dag}
                  </span>
                  <ul className="konsolkort flex flex-col divide-y divide-harlinje">
                    {poster.map((f, n) => {
                      const sort = SIDTYP[f.typ] ?? SIDTYP.annat;
                      return (
                        <li
                          key={`${f.url}-${n}`}
                          className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-3"
                          style={{ animation: "stig 0.4s ease-out both" }}
                        >
                          <span
                            className={`data w-20 shrink-0 text-[10.5px] uppercase tracking-[0.08em] ${sort.farg}`}
                          >
                            {sort.etikett}
                          </span>
                          <span className="shrink-0 text-[14px] font-medium text-black">
                            {f.konkurrent}
                          </span>
                          <span className="text-[14px] leading-relaxed text-kropp">
                            {f.vad}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>

        <Sektor
          konkurrenter={rapport.konkurrenter}
          egen={rapport.egen_djup}
          egetNamn={rapport.egen.namn}
        />

        <section className="flex flex-col gap-4">
          <Avdelning>Where you stand</Avdelning>
          {/* Their metric row is four across; there are five numbers here and
              "1.80 bn SEK" does not fit a fifth of this column, so it is three
              across and the row wraps. The tile itself is their spec. */}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
          <p className="flex items-center gap-2 text-sm text-dampad">
            <span
              aria-hidden="true"
              className={`size-1.5 shrink-0 rounded-full ${bevakas ? "bg-gron" : "bg-ask"}`}
            />
            {bevakas
              ? "Watching — changes show up here."
              : "Not watching yet. Turn it on from the summary to keep this page fed."}
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <Avdelning>What to do</Avdelning>
          <ol className="flex flex-col gap-3">
            {rapport.atgarder.map((a, n) => (
              <li key={a} className="konsolkort flex gap-4 p-5">
                <span className="data pt-1 text-[13px] font-semibold text-amber">
                  {n + 1}
                </span>
                <span className="rubrik text-[17px] leading-[1.375] font-medium">{a}</span>
              </li>
            ))}
          </ol>
        </section>

        <Epost id={id} epost={epost} />
      </div>
    </div>
  );
}
