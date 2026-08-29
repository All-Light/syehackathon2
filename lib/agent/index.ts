import { parallellt } from "../firecrawl";
import type { Handelse, Konkurrent } from "../types";
import { profileraSjalv } from "./profil";
import { syntetisera } from "./syntes";
import { undersokKonkurrent } from "./undersok";
import { upptackKonkurrenter, type Kandidat } from "./upptack";

export type Indata = { url: string; angivna?: string[] };

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

  yield { typ: "steg", steg: "profil", text: "Läser din webbplats" };
  const egen = await tid("profil", () => profileraSjalv(indata.url));
  yield { typ: "profil", egen };

  yield {
    typ: "steg",
    steg: "upptack",
    text: `Letar konkurrenter till ${egen.namn}`,
  };

  const angivna = (indata.angivna ?? []).filter(Boolean);
  const hittade = await tid("upptack", () => upptackKonkurrenter(egen, angivna, logg("upptack")));
  while (kö.length) yield kö.shift()!;

  const kandidater: { k: Kandidat; hittadAv: "du" | "agenten" }[] = [
    ...angivna.map((u) => ({
      k: { namn: new URL(u.startsWith("http") ? u : `https://${u}`).hostname.replace(/^www\./, ""), url: u.startsWith("http") ? u : `https://${u}`, varfor: "Du pekade ut dem." },
      hittadAv: "du" as const,
    })),
    ...hittade.map((k) => ({ k, hittadAv: "agenten" as const })),
  ].slice(0, 4);

  for (const { k, hittadAv } of kandidater) {
    yield { typ: "kandidat", namn: k.namn, url: k.url };
    if (hittadAv === "agenten") {
      yield { typ: "steg", steg: "upptack", text: `Hittade ${k.namn} — ${k.varfor}` };
    }
  }

  const svensk = /svensk/i.test(egen.sprak) || /sverige/i.test(egen.geografi);

  // All five at once. The wall clock is the demo's budget, and Firecrawl and
  // the grader both take this comfortably.
  const klara: Konkurrent[] = [];
  const arbete = parallellt(kandidater, 4, async ({ k, hittadAv }) => {
    const ut = await tid(`undersok:${k.namn}`, () =>
      undersokKonkurrent(k, hittadAv, svensk, logg("undersok")),
    ).catch(() => null);
    if (ut) klara.push(ut);
    kö.push({ typ: "steg", steg: "undersok", text: `Klar med ${k.namn}` });
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
    yield { typ: "fel", text: "Hittade inga konkurrenter som gick att läsa." };
    return;
  }

  yield { typ: "steg", steg: "syntes", text: "Jämför och drar slutsatser" };
  const rapport = await tid("syntes", () => syntetisera(egen, klara));
  yield { typ: "klar", rapport, id: null };
}

function tick(): Promise<false> {
  return new Promise((r) => setTimeout(() => r(false), 400));
}
