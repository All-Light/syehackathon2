"use client";

import { useState } from "react";
import Betala from "@/components/Betala";
import Djupdyk from "@/components/Djupdyk";
import Lyssna from "@/components/Lyssna";
import { Framsida, Kallor } from "@/components/Tryck";
import type { Forandring, Insikt, Konkurrent, Namngiven, Rapport } from "@/lib/types";

function Kallhanvisning({ kalla }: { kalla: { url: string; citat: string } | null }) {
  const [oppen, satt] = useState(false);
  if (!kalla) return null;
  return (
    <span className="inline-flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => satt((o) => !o)}
        className="ej-tryck self-start text-[11px] uppercase tracking-[0.12em] text-amber underline-offset-4 hover:underline"
        aria-expanded={oppen}
      >
        {oppen ? "Hide source" : "Show source"}
      </button>
      <span
        className={`kalla-text border-l-2 border-linje pl-3 text-sm text-dampad ${
          oppen ? "block" : "hidden"
        }`}
      >
        <span className="block italic">&ldquo;{kalla.citat}&rdquo;</span>
        <a
          href={kalla.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block break-all text-xs text-amber underline-offset-4 hover:underline"
        >
          {kalla.url}
        </a>
      </span>
    </span>
  );
}

function Insikter({ rubrik, poster }: { rubrik: string; poster: Insikt[] }) {
  if (!poster.length) return null;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[11px] uppercase tracking-[0.16em] text-dampad">{rubrik}</h2>
      <ul className="flex flex-col gap-5">
        {poster.map((i) => (
          <li key={i.rubrik} className="flex flex-col gap-1.5">
            <h3 className="font-medium text-black">
              {i.rubrik}
              {i.konkurrent && (
                <span className="ml-2 text-sm font-normal text-dampad">{i.konkurrent}</span>
              )}
            </h3>
            <p className="text-[15px] leading-relaxed text-dampad">{i.text}</p>
            <Kallhanvisning kalla={i.kalla} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Kort({ k, id }: { k: Konkurrent; id: string | null }) {
  return (
    <article className="tryck-hel flex flex-col gap-4 border border-linje bg-papper-djup/50 p-5">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="font-serif text-2xl text-black">{k.namn}</h3>
          {k.hittadAv === "agenten" && (
            <span className="rounded-full bg-amber/12 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-amber">
              Found for you
            </span>
          )}
        </div>
        <a
          href={k.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-dampad underline-offset-4 hover:text-amber hover:underline"
        >
          {k.url.replace(/^https?:\/\//, "")}
        </a>
      </header>

      <p className="text-[15px] leading-relaxed text-black">{k.positionering}</p>

      {k.priser.length > 0 ? (
        <ul className="flex flex-col gap-2 border-t border-linje pt-4">
          {k.priser.map((p, n) => (
            <li key={`${p.namn}-${n}`} className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-dampad">{p.namn}</span>
              <span className="siffror text-sm font-medium text-black">
                {p.pris}
                {p.period && <span className="text-dampad"> / {p.period}</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-linje pt-4 text-sm text-dampad">
          No price published on the site.
        </p>
      )}

      {k.orgdata && (k.orgdata.omsattningTkr || k.orgdata.anstallda) && (
        <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-linje pt-4">
          {k.orgdata.omsattningTkr !== null && (
            <div>
              <dt className="text-[10px] uppercase tracking-[0.12em] text-dampad">Revenue</dt>
              <dd className="siffror text-sm text-black">
                {(k.orgdata.omsattningTkr / 1000).toLocaleString("en-GB", {
                  maximumFractionDigits: 1,
                })}{" "}
                MSEK
                {k.orgdata.ar && <span className="text-dampad"> ({k.orgdata.ar})</span>}
              </dd>
            </div>
          )}
          {k.orgdata.anstallda !== null && (
            <div>
              <dt className="text-[10px] uppercase tracking-[0.12em] text-dampad">Employees</dt>
              <dd className="siffror text-sm text-black">{k.orgdata.anstallda}</dd>
            </div>
          )}
          {k.orgdata.tillvaxtProcent !== null && (
            <div>
              <dt className="text-[10px] uppercase tracking-[0.12em] text-dampad">Growth</dt>
              <dd className="siffror text-sm text-black">
                {k.orgdata.tillvaxtProcent > 0 ? "+" : ""}
                {k.orgdata.tillvaxtProcent} %
              </dd>
            </div>
          )}
        </dl>
      )}

      {k.svagheter.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-linje pt-4">
          {k.svagheter.map((s) => (
            <li key={s} className="text-sm text-dampad">
              {s}
            </li>
          ))}
        </ul>
      )}

      {id && (
        <div className={`border-t border-linje pt-4 ${k.djup ? "" : "ej-tryck"}`}>
          <Djupdyk id={id} url={k.url} namn={k.namn} befintlig={k.djup} />
        </div>
      )}
    </article>
  );
}

export default function Rapportvy({
  rapport,
  id,
  bevakasFran = false,
  betald = false,
}: {
  rapport: Rapport;
  id: string | null;
  bevakasFran?: boolean;
  betald?: boolean;
}) {
  const [bevakas, sattBevakas] = useState(bevakasFran);
  const [delad, sattDelad] = useState(false);
  const [kontrollerar, sattKontrollerar] = useState(false);
  const [forandringar, sattForandringar] = useState<Forandring[] | null>(null);
  const [lasta, sattLasta] = useState<Konkurrent[]>(rapport.konkurrenter);
  const [ovriga, sattOvriga] = useState<Namngiven[]>(rapport.ovriga ?? []);
  const [soker, sattSoker] = useState(false);
  const [laser, sattLaser] = useState<string | null>(null);
  const hittade = lasta.filter((k) => k.hittadAv === "agenten").length;

  async function vaxlaBevakning() {
    if (!id) return;
    const nytt = !bevakas;
    sattBevakas(nytt);
    await fetch("/api/bevaka", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, bevakas: nytt }),
    }).catch(() => sattBevakas(!nytt));
  }

  async function sokFler() {
    if (!id || soker) return;
    sattSoker(true);
    try {
      const svar = await fetch("/api/fler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await svar.json()) as { nya?: Namngiven[] };
      if (data.nya?.length) sattOvriga((o) => [...o, ...data.nya!]);
    } catch {
      // Nothing found is the same outcome to the reader as a failed sweep.
    } finally {
      sattSoker(false);
    }
  }

  async function las(url: string) {
    if (!id || laser) return;
    sattLaser(url);
    try {
      const svar = await fetch("/api/undersok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, url }),
      });
      const data = (await svar.json()) as { konkurrent?: Konkurrent };
      if (data.konkurrent) {
        sattLasta((k) => [...k, data.konkurrent!]);
        sattOvriga((o) => o.filter((x) => x.url !== url));
      }
    } catch {
      // Leave it in the list; the reader can try again.
    } finally {
      sattLaser(null);
    }
  }

  async function koraKontroll() {
    if (!id || kontrollerar) return;
    sattKontrollerar(true);
    try {
      const svar = await fetch("/api/kontroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await svar.json()) as { forandringar: Forandring[] };
      sattForandringar(data.forandringar ?? []);
    } catch {
      sattForandringar([]);
    } finally {
      sattKontrollerar(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-14 px-6 py-16">
      <Framsida rapport={rapport} />

      <header className="ej-tryck flex flex-col gap-4">
        <span className="text-[11px] uppercase tracking-[0.16em] text-dampad">
          {rapport.egen.namn}
        </span>
        <h1 className="font-serif text-4xl leading-[1.15] text-black sm:text-5xl">
          {rapport.sammanfattning}
        </h1>
        <p className="text-[15px] text-dampad">
          {lasta.length} competitors read
          {hittade > 0 && (
            <>
              , <span className="text-amber">{hittade} of them found for you</span>
            </>
          )}
          .
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-[11px] uppercase tracking-[0.16em] text-dampad">To do this week</h2>
        <ol className="flex flex-col gap-4">
          {rapport.atgarder.map((a, n) => (
            <li key={a} className="flex gap-4">
              <span className="siffror pt-0.5 text-sm text-amber">{n + 1}</span>
              <span className="text-lg leading-snug text-black">{a}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-10 sm:grid-cols-2">
        <Insikter rubrik="Where they are stronger" poster={rapport.hot} />
        <Insikter rubrik="Where you can attack" poster={rapport.luckor} />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-[11px] uppercase tracking-[0.16em] text-dampad">The competitors</h2>
        <div className="flex flex-col gap-4">
          {lasta.map((k) => (
            <Kort key={k.url} k={k} id={id} />
          ))}
        </div>
      </section>

      {(ovriga.length > 0 || id) && (
        <section className="ej-tryck flex flex-col gap-4">
          <h2 className="text-[11px] uppercase tracking-[0.16em] text-dampad">
            Also competing{ovriga.length > 0 && ` (${ovriga.length})`}
          </h2>
          {ovriga.length > 0 ? (
            <>
              <p className="text-sm text-dampad">
                Named but not read yet. Reading one takes about twenty seconds.
              </p>
              <ul className="flex flex-col divide-y divide-linje border-y border-linje">
                {ovriga.map((o) => (
                  <li
                    key={o.url}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
                  >
                    <span className="flex flex-col gap-0.5">
                      <a
                        href={o.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-black underline-offset-4 hover:text-amber hover:underline"
                      >
                        {o.namn}
                      </a>
                      <span className="text-sm text-dampad">{o.varfor}</span>
                    </span>
                    {id && (
                      <button
                        type="button"
                        onClick={() => las(o.url)}
                        disabled={laser !== null}
                        className="shrink-0 border border-linje px-3 py-1.5 text-xs text-dampad hover:border-black hover:text-black disabled:opacity-50"
                      >
                        {laser === o.url ? "Reading…" : "Read this one"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-dampad">
              Everything the first sweep found has been read.
            </p>
          )}
          {id && (
            <button
              type="button"
              onClick={sokFler}
              disabled={soker}
              className="self-start border border-linje px-5 py-2.5 text-sm text-dampad hover:border-black hover:text-black disabled:opacity-50"
            >
              {soker ? "Sweeping again…" : "Find more competitors"}
            </button>
          )}
        </section>
      )}

      {forandringar !== null && (
        <section className="ej-tryck flex flex-col gap-4 border-l-2 border-amber pl-5">
          <h2 className="text-[11px] uppercase tracking-[0.16em] text-dampad">
            Since this report was written
          </h2>
          {forandringar.length === 0 ? (
            <p className="text-[15px] text-dampad">
              Nothing has changed on the{" "}
              {lasta.reduce((n, k) => n + k.sidor.length, 0)} pages we watch.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {forandringar.map((f, n) => (
                <li key={`${f.url}-${n}`} className="flex flex-col gap-0.5">
                  <span className="text-[15px] text-black">{f.vad}</span>
                  <span className="text-xs text-dampad">{f.konkurrent}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {id && (
        <footer className="ej-tryck flex flex-wrap items-center gap-3 border-t border-linje pt-8">
          <button
            type="button"
            onClick={vaxlaBevakning}
            className={`px-5 py-2.5 text-sm transition-colors ${
              bevakas
                ? "bg-amber text-papper"
                : "border border-black text-black hover:bg-black hover:text-papper"
            }`}
          >
            {bevakas ? "Watching — changes show up on the dashboard" : "Watch these"}
          </button>
          <Lyssna id={id} />
          <a
            href={`/r/${id}/bevakning`}
            className="border border-linje px-5 py-2.5 text-sm text-dampad transition-colors hover:border-black hover:text-black"
          >
            Open the dashboard
          </a>
          <button
            type="button"
            onClick={koraKontroll}
            disabled={kontrollerar}
            className="border border-linje px-5 py-2.5 text-sm text-dampad hover:border-black hover:text-black disabled:opacity-50"
          >
            {kontrollerar ? "Re-reading the pages…" : "Check now"}
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(`${location.origin}/r/${id}`);
              sattDelad(true);
              setTimeout(() => sattDelad(false), 2200);
            }}
            className="border border-linje px-5 py-2.5 text-sm text-dampad hover:border-black hover:text-black"
          >
            {delad ? "Link copied" : "Share report"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="border border-linje px-5 py-2.5 text-sm text-dampad hover:border-black hover:text-black"
          >
            Save as PDF
          </button>
        </footer>
      )}

      {id && (
        <section className="ej-tryck flex flex-col gap-3 border-t border-linje pt-12">
          <h2 className="text-[11px] uppercase tracking-[0.16em] text-dampad">
            The full report
          </h2>
          <p className="max-w-lg text-[15px] leading-relaxed text-dampad">
            {rapport.full
              ? "Five arguments, the positioning map, and a note on why these competitors and not others."
              : "One answer, argued in five parts, with every claim marked by how far it sits from the page it came from. Two to four minutes."}
          </p>
          {/* Its own tab: it is a different document from this one, and a
              reader who opens it should not lose their place here. `skriv=1`
              carries the press across the tab boundary so the destination
              starts writing on arrival instead of asking a second time; it is
              left off when a report already exists, since there is nothing to
              write. */}
          <a
            href={`/r/${id}/full${rapport.full ? "" : "?skriv=1"}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 self-start border border-black px-5 py-2.5 text-sm text-black transition-colors hover:bg-black hover:text-papper"
          >
            {rapport.full ? "Open the full report" : "Write the full report"}
          </a>
        </section>
      )}

      {id && !betald && (
        <div className="ej-tryck">
          <Betala id={id} betald={betald} />
        </div>
      )}

      <Kallor rapport={rapport} />
    </div>
  );
}
