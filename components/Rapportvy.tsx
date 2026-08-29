"use client";

import { useState } from "react";
import type { Forandring, Insikt, Konkurrent, Rapport } from "@/lib/types";

function Kallhanvisning({ kalla }: { kalla: { url: string; citat: string } | null }) {
  const [oppen, satt] = useState(false);
  if (!kalla) return null;
  return (
    <span className="inline-flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => satt((o) => !o)}
        className="self-start text-[11px] uppercase tracking-[0.12em] text-amber underline-offset-4 hover:underline"
        aria-expanded={oppen}
      >
        {oppen ? "Dölj källa" : "Visa källa"}
      </button>
      {oppen && (
        <span className="block border-l-2 border-linje pl-3 text-sm text-dampad">
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
      )}
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

function Kort({ k }: { k: Konkurrent }) {
  return (
    <article className="flex flex-col gap-4 border border-linje bg-papper-djup/50 p-5">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="font-serif text-2xl text-black">{k.namn}</h3>
          {k.hittadAv === "agenten" && (
            <span className="rounded-full bg-amber/12 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-amber">
              Hittad åt dig
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
          Inget pris publicerat på sajten.
        </p>
      )}

      {k.orgdata && (k.orgdata.omsattningTkr || k.orgdata.anstallda) && (
        <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-linje pt-4">
          {k.orgdata.omsattningTkr !== null && (
            <div>
              <dt className="text-[10px] uppercase tracking-[0.12em] text-dampad">Omsättning</dt>
              <dd className="siffror text-sm text-black">
                {(k.orgdata.omsattningTkr / 1000).toLocaleString("sv-SE", {
                  maximumFractionDigits: 1,
                })}{" "}
                Mkr
                {k.orgdata.ar && <span className="text-dampad"> ({k.orgdata.ar})</span>}
              </dd>
            </div>
          )}
          {k.orgdata.anstallda !== null && (
            <div>
              <dt className="text-[10px] uppercase tracking-[0.12em] text-dampad">Anställda</dt>
              <dd className="siffror text-sm text-black">{k.orgdata.anstallda}</dd>
            </div>
          )}
          {k.orgdata.tillvaxtProcent !== null && (
            <div>
              <dt className="text-[10px] uppercase tracking-[0.12em] text-dampad">Tillväxt</dt>
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
    </article>
  );
}

export default function Rapportvy({
  rapport,
  id,
  bevakasFran = false,
}: {
  rapport: Rapport;
  id: string | null;
  bevakasFran?: boolean;
}) {
  const [bevakas, sattBevakas] = useState(bevakasFran);
  const [delad, sattDelad] = useState(false);
  const [kontrollerar, sattKontrollerar] = useState(false);
  const [forandringar, sattForandringar] = useState<Forandring[] | null>(null);
  const hittade = rapport.konkurrenter.filter((k) => k.hittadAv === "agenten").length;

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
      <header className="flex flex-col gap-4">
        <span className="text-[11px] uppercase tracking-[0.16em] text-dampad">
          {rapport.egen.namn}
        </span>
        <h1 className="font-serif text-4xl leading-[1.15] text-black sm:text-5xl">
          {rapport.sammanfattning}
        </h1>
        <p className="text-[15px] text-dampad">
          {rapport.konkurrenter.length} konkurrenter lästa
          {hittade > 0 && (
            <>
              , varav <span className="text-amber">{hittade} hittade åt dig</span>
            </>
          )}
          .
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-[11px] uppercase tracking-[0.16em] text-dampad">Att göra i veckan</h2>
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
        <Insikter rubrik="Där de är starkare" poster={rapport.hot} />
        <Insikter rubrik="Där du kan attackera" poster={rapport.luckor} />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-[11px] uppercase tracking-[0.16em] text-dampad">Konkurrenterna</h2>
        <div className="flex flex-col gap-4">
          {rapport.konkurrenter.map((k) => (
            <Kort key={k.url} k={k} />
          ))}
        </div>
      </section>

      {forandringar !== null && (
        <section className="flex flex-col gap-4 border-l-2 border-amber pl-5">
          <h2 className="text-[11px] uppercase tracking-[0.16em] text-dampad">
            Sedan rapporten skrevs
          </h2>
          {forandringar.length === 0 ? (
            <p className="text-[15px] text-dampad">
              Inget har ändrats på de {rapport.konkurrenter.reduce((n, k) => n + k.sidor.length, 0)}{" "}
              sidor vi bevakar.
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
        <footer className="flex flex-wrap items-center gap-3 border-t border-linje pt-8">
          <button
            type="button"
            onClick={vaxlaBevakning}
            className={`px-5 py-2.5 text-sm transition-colors ${
              bevakas
                ? "bg-amber text-papper"
                : "border border-black text-black hover:bg-black hover:text-papper"
            }`}
          >
            {bevakas ? "Bevakas — vi hör av oss" : "Bevaka dessa"}
          </button>
          <button
            type="button"
            onClick={koraKontroll}
            disabled={kontrollerar}
            className="border border-linje px-5 py-2.5 text-sm text-dampad hover:border-black hover:text-black disabled:opacity-50"
          >
            {kontrollerar ? "Läser om sidorna…" : "Kör kontroll nu"}
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
            {delad ? "Länk kopierad" : "Dela rapport"}
          </button>
        </footer>
      )}
    </div>
  );
}
