"use client";

import { useEffect, useRef, useState } from "react";
import { Svep } from "@/components/Arbetsvy";
import type {
  Djupdykning,
  DjupHandelse,
  Fynd,
  Insikt,
  Kalla,
  Vinkel,
  VinkelId,
} from "@/lib/types";

/**
 * The five angles are fixed, so the whole team can be drawn the moment the run
 * starts. Seeing five researchers out at once is the point of this screen — an
 * empty list that fills up would read as one worker doing five things in turn.
 */
const LAGET: { id: VinkelId; rubrik: string }[] = [
  { id: "affarsmodell", rubrik: "Business model" },
  { id: "produkt", rubrik: "Product" },
  { id: "malgrupp", rubrik: "Who they sell to" },
  { id: "rykte", rubrik: "What customers say" },
  { id: "bolag", rubrik: "The company" },
];

function Kallhanvisning({ kalla }: { kalla: Kalla | null }) {
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
        {oppen ? "Hide source" : "Show source"}
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

function Fyndlista({ fynd }: { fynd: Fynd[] }) {
  if (!fynd.length) {
    return <p className="text-sm text-dampad">Nothing worth reporting from this angle.</p>;
  }
  return (
    <ul className="flex flex-col gap-4">
      {fynd.map((f, n) => (
        <li key={`${n}-${f.text.slice(0, 40)}`} className="flex flex-col gap-1.5">
          <p className="text-[15px] leading-relaxed text-black">{f.text}</p>
          <Kallhanvisning kalla={f.kalla} />
        </li>
      ))}
    </ul>
  );
}

function Insiktslista({ rubrik, poster }: { rubrik: string; poster: Insikt[] }) {
  if (!poster.length) return null;
  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-[11px] uppercase tracking-[0.16em] text-dampad">{rubrik}</h3>
      <ul className="flex flex-col gap-5">
        {poster.map((i, n) => (
          <li key={`${n}-${i.rubrik}`} className="flex flex-col gap-1.5">
            <h4 className="font-medium text-black">
              {i.rubrik}
              {i.konkurrent && (
                <span className="ml-2 text-sm font-normal text-dampad">{i.konkurrent}</span>
              )}
            </h4>
            <p className="text-[15px] leading-relaxed text-dampad">{i.text}</p>
            <Kallhanvisning kalla={i.kalla} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The team at work: everyone visible from the start, filling in as they report. */
function Tavla({ klara, sekunder }: { klara: Vinkel[]; sekunder: number }) {
  return (
    <ul className="flex flex-col divide-y divide-linje border-y border-linje">
      {LAGET.map((plats) => {
        const klar = klara.find((v) => v.id === plats.id);
        return (
          <li key={plats.id} className="flex flex-col gap-3 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="flex items-center gap-2.5">
                {/* One tick, same as this researcher's tick on the scale above:
                    standing once they have reported, low while still out. */}
                <span className={`svep-tand${klar ? " svep-tand-klar" : ""}`} />
                <span className={klar ? "text-black" : "text-dampad"}>
                  {klar?.rubrik ?? plats.rubrik}
                </span>
              </span>
              <span className="siffror text-xs text-dampad">
                {klar
                  ? `${klar.fynd.length} ${klar.fynd.length === 1 ? "finding" : "findings"}`
                  : `researching · ${sekunder}s`}
              </span>
            </div>
            {klar && (
              <div style={{ animation: "stig 0.4s ease-out both" }}>
                <Fyndlista fynd={klar.fynd} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function datum(skapad: string) {
  const d = new Date(skapad);
  // Rendered on the server too, so no locale formatting that could differ there.
  return Number.isNaN(d.getTime()) ? skapad : d.toISOString().slice(0, 10);
}

function Dossier({ djup, namn }: { djup: Djupdykning; namn: string }) {
  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-3">
        <span className="text-[11px] uppercase tracking-[0.16em] text-dampad">
          Deep dive · {namn}
        </span>
        <h2 className="font-serif text-3xl leading-[1.15] text-black sm:text-4xl">
          {djup.sammanfattning}
        </h2>
      </header>

      <div className="grid gap-10 sm:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h3 className="text-[11px] uppercase tracking-[0.16em] text-dampad">
            How the business works
          </h3>
          <p className="text-[15px] leading-relaxed text-black">{djup.affarsmodell}</p>
        </section>
        <section className="flex flex-col gap-3">
          <h3 className="text-[11px] uppercase tracking-[0.16em] text-dampad">
            How the money comes in
          </h3>
          <p className="text-[15px] leading-relaxed text-black">{djup.intaktsmodell}</p>
        </section>
      </div>

      <div className="grid gap-10 sm:grid-cols-2">
        <Insiktslista rubrik="Where they beat you" poster={djup.battre} />
        <Insiktslista rubrik="Where you beat them" poster={djup.samre} />
      </div>

      {djup.taktik.length > 0 && (
        <section className="flex flex-col gap-4">
          <h3 className="text-[11px] uppercase tracking-[0.16em] text-dampad">
            What to do about it
          </h3>
          <ol className="flex flex-col gap-4">
            {djup.taktik.map((t, n) => (
              <li key={`${n}-${t.slice(0, 40)}`} className="flex gap-4">
                <span className="siffror pt-0.5 text-sm text-amber">{n + 1}</span>
                <span className="text-lg leading-snug text-black">{t}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {djup.vinklar.length > 0 && (
        <section className="flex flex-col gap-6">
          <h3 className="text-[11px] uppercase tracking-[0.16em] text-dampad">
            What each researcher found
          </h3>
          <div className="flex flex-col gap-8">
            {djup.vinklar.map((v) => (
              <article key={v.id} className="flex flex-col gap-4 border-l-2 border-linje pl-5">
                <h4 className="font-serif text-xl text-black">{v.rubrik}</h4>
                <Fyndlista fynd={v.fynd} />
              </article>
            ))}
          </div>
        </section>
      )}

      <p className="border-t border-linje pt-6 text-xs text-dampad">
        Written by <span className="siffror">{djup.skrivenAv}</span> on{" "}
        <span className="siffror">{datum(djup.skapad)}</span>.
      </p>
    </div>
  );
}

export default function Djupdyk({
  id,
  url,
  namn,
  befintlig,
}: {
  id: string;
  url: string;
  namn: string;
  befintlig?: Djupdykning | null;
}) {
  const [arbetar, sattArbetar] = useState(false);
  const [rader, sattRader] = useState<string[]>([]);
  const [vinklar, sattVinklar] = useState<Vinkel[]>([]);
  const [djup, sattDjup] = useState<Djupdykning | null>(null);
  const [fel, sattFel] = useState<string | null>(null);
  const [sekunder, sattSekunder] = useState(0);
  const avbryt = useRef<AbortController | null>(null);

  // A dive already stored on the report is the same thing a run would produce.
  const visad = djup ?? befintlig ?? null;

  useEffect(() => () => avbryt.current?.abort(), []);

  useEffect(() => {
    if (!arbetar) return;
    const klocka = setInterval(() => sattSekunder((s) => s + 1), 1000);
    return () => clearInterval(klocka);
  }, [arbetar]);

  function hantera(h: DjupHandelse) {
    switch (h.typ) {
      case "steg":
        sattRader((r) => [...r, h.text]);
        break;
      case "vinkel":
        sattVinklar((v) =>
          v.some((x) => x.id === h.vinkel.id) ? v : [...v, h.vinkel],
        );
        break;
      case "klar":
        sattDjup(h.djup);
        sattArbetar(false);
        break;
      case "fel":
        sattFel(h.text);
        sattArbetar(false);
        break;
    }
  }

  async function starta() {
    if (arbetar) return;
    sattArbetar(true);
    sattFel(null);
    sattRader([]);
    sattVinklar([]);
    sattSekunder(0);

    avbryt.current?.abort();
    const styr = new AbortController();
    avbryt.current = styr;

    try {
      const svar = await fetch("/api/djupdyk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, url }),
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
          hantera(JSON.parse(rad.slice(6)) as DjupHandelse);
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      sattFel(e instanceof Error ? e.message : "The deep dive could not be finished.");
    } finally {
      sattArbetar(false);
    }
  }

  if (visad && !arbetar) {
    return (
      <section className="flex flex-col gap-12 border-t border-linje pt-10">
        <Dossier djup={visad} namn={namn} />
      </section>
    );
  }

  if (arbetar) {
    return (
      <section className="flex flex-col gap-8 border-t border-linje pt-10">
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2.5 text-[11px] uppercase tracking-[0.16em] text-dampad">
            <Svep totalt={LAGET.length} klara={vinklar.length} />
            {vinklar.length} of {LAGET.length} angles in
          </span>
          <h2 className="font-serif text-3xl leading-tight text-black sm:text-4xl">
            Five researchers are reading {namn} at once
          </h2>
          <p className="text-[15px] text-dampad">
            They report back one at a time. Takes a minute or two.
          </p>
        </div>

        <Tavla klara={vinklar} sekunder={sekunder} />

        {rader.length > 0 && (
          <div className="flex flex-col gap-1.5 overflow-hidden">
            {rader.slice(-6).map((r, i, alla) => (
              <p
                key={`${r}-${i}`}
                className="siffror text-sm text-dampad"
                style={{
                  opacity: 0.25 + (0.75 * (i + 1)) / alla.length,
                  animation: "stig 0.4s ease-out both",
                }}
              >
                {r}
              </p>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 border-t border-linje pt-10">
      <h2 className="text-[11px] uppercase tracking-[0.16em] text-dampad">Go deeper</h2>
      <p className="max-w-lg text-[15px] leading-relaxed text-dampad">
        Five researchers read {namn} from five angles at once — how the business works,
        the product, who they sell to, what people say, and the company behind it — then
        one writer turns it into a picture of where they beat you.
      </p>
      <button
        type="button"
        onClick={starta}
        className="mt-2 self-start border border-black px-5 py-2.5 text-sm text-black transition-colors hover:bg-black hover:text-papper"
      >
        Deep dive
      </button>
      {fel && (
        <p className="text-sm text-rod">
          {fel} Nothing was lost — you can start it again.
        </p>
      )}
    </section>
  );
}
