import { parallellt } from "../firecrawl";
import type { Handelse, Konkurrent, Namngiven } from "../types";
import { profileraSjalv } from "./profil";
import { undersokEgen } from "./sjalv";
import { syntetisera } from "./syntes";
import { undersokKonkurrent } from "./undersok";
import { upptackKonkurrenter, type Kandidat } from "./upptack";
import { arSvensk } from "./sprak";

export type Indata = { url: string; angivna?: string[] };

/** How many competitors get the full map-scrape-extract treatment. */
const DJUPT = 5;

/** Wall-clock per stage. Guessing at which step is slow wastes more time than
 *  measuring it does. */
async function tid<T>(namn: string, arbete: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    return await arbete();
  } finally {
    console.log(`[tid] ${namn}: ${((Date.now() - start) / 1000).toFixed(1)}s`);
  }
}

/**
 * The pipeline. Agentic where it counts — it writes its own search queries and
 * chooses which pages to read — but typed and bounded, so it is demo-safe.
 * Yields as it goes: the working view is the proof that real work is happening.
 */
export async function* kor(indata: Indata): AsyncGenerator<Handelse> {
  const kö: Handelse[] = [];
  const logg = (steg: string) => (text: string) => kö.push({ typ: "steg", steg, text });

  yield { typ: "steg", steg: "profil", text: "Reading your website" };
  const egen = await tid("profil", () => profileraSjalv(indata.url));
  yield { typ: "profil", egen };

  // Read our own site the way we read a competitor's. It depends on nothing but
  // the profile, so it starts here and runs alongside discovery and the
  // researchers instead of adding its own half-minute to the wall clock. It is
  // deliberately not awaited until just before the synthesis.
  yield { typ: "steg", steg: "egen", text: `Reading ${egen.namn} the way we read a competitor` };
  const egetArbete = tid("egen", () => undersokEgen(egen, logg("egen")))
    .then((ut) => {
      kö.push({
        typ: "steg",
        steg: "egen",
        text: ut
          ? `Read ${ut.priser.length} published price${ut.priser.length === 1 ? "" : "s"} on ${egen.namn}`
          : `Could not read ${egen.namn} in depth — the comparison continues without it`,
      });
      return ut;
    })
    .catch(() => null);

  yield {
    typ: "steg",
    steg: "upptack",
    text: `Looking for competitors to ${egen.namn}`,
  };

  const angivna = (indata.angivna ?? []).filter(Boolean);
  const hittade = await tid("upptack", () => upptackKonkurrenter(egen, angivna, logg("upptack")));
  while (kö.length) yield kö.shift()!;

  const alla: { k: Kandidat; hittadAv: "du" | "agenten" }[] = [
    ...angivna.map((u) => ({
      k: {
        namn: new URL(u.startsWith("http") ? u : `https://${u}`).hostname.replace(/^www\./, ""),
        url: u.startsWith("http") ? u : `https://${u}`,
        varfor: "You named them.",
      },
      hittadAv: "du" as const,
    })),
    ...hittade.map((k) => ({ k, hittadAv: "agenten" as const })),
  ];

  // Naming fifteen costs the same three searches as naming five. Reading one
  // costs a map, two scrapes and an LLM call, so only the top few are read now
  // — the rest are listed, and the user can promote any of them.
  const kandidater = alla.slice(0, DJUPT);
  const ovriga: Namngiven[] = alla.slice(DJUPT).map(({ k, hittadAv }) => ({
    namn: k.namn,
    url: k.url,
    varfor: k.varfor,
    hittadAv,
  }));

  if (ovriga.length) {
    yield {
      typ: "steg",
      steg: "upptack",
      text: `Named ${alla.length} competitors — reading the top ${kandidater.length} in depth`,
    };
  }

  for (const { k, hittadAv } of kandidater) {
    yield { typ: "kandidat", namn: k.namn, url: k.url };
    if (hittadAv === "agenten") {
      yield { typ: "steg", steg: "upptack", text: `Found ${k.namn} — ${k.varfor}` };
    }
  }

  const svensk = arSvensk(egen);

  // All five at once. The wall clock is the demo's budget, and Firecrawl and
  // the grader both take this comfortably.
  const klara: Konkurrent[] = [];
  const arbete = parallellt(kandidater, DJUPT, async ({ k, hittadAv }) => {
    const ut = await tid(`undersok:${k.namn}`, () =>
      undersokKonkurrent(k, hittadAv, svensk, logg("undersok")),
    ).catch(() => null);
    if (ut) klara.push(ut);
    kö.push({ typ: "steg", steg: "undersok", text: `Done with ${k.namn}` });
    if (ut) kö.push({ typ: "konkurrent", konkurrent: ut });
    return ut;
  });

  // Drain the queue while the researchers run, so the view keeps moving.
  while (true) {
    const klar = await Promise.race([arbete.then(() => true), tick()]);
    while (kö.length) yield kö.shift()!;
    if (klar === true) break;
  }

  if (!klara.length) {
    yield { typ: "fel", text: "Found no competitors we could read." };
    return;
  }

  // By now our own research has had the whole discovery-and-research run to
  // finish in, so this almost always resolves at once. Cap the wait anyway: the
  // report must not be held hostage by the one part of it that is a bonus.
  const egenDjup = await forst(egetArbete, 20_000);
  while (kö.length) yield kö.shift()!;

  yield { typ: "steg", steg: "syntes", text: "Comparing and drawing conclusions" };
  const rapport = await tid("syntes", () => syntetisera(egen, klara, ovriga));
  yield { typ: "klar", rapport: { ...rapport, egen_djup: egenDjup }, id: null };
}

/** Whatever the work has produced by `ms`, or null. The timer is cleared so a
 *  finished run does not sit waiting on it. */
async function forst<T>(arbete: Promise<T | null>, ms: number): Promise<T | null> {
  let klocka: ReturnType<typeof setTimeout> | undefined;
  const grans = new Promise<null>((k) => {
    klocka = setTimeout(() => k(null), ms);
  });
  try {
    return await Promise.race([arbete, grans]);
  } finally {
    clearTimeout(klocka);
  }
}

function tick(): Promise<false> {
  return new Promise((r) => setTimeout(() => r(false), 400));
}
