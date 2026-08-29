import { db } from "./db";
import type { Handelse, Rapport } from "./types";

/**
 * Sent first on the analysis stream, before the agent has done anything, so the
 * browser can show a durable address while the run is still in flight.
 *
 * This belongs in lib/types.ts next to the rest of `Handelse`; it lives here
 * because that file is being edited elsewhere right now. The client recognises
 * it structurally rather than importing this type, so moving it is a one-liner.
 */
export type Korningshandelse = { typ: "korning"; id: string };

export type KorStatus = "kor" | "klar" | "fel";

/** Exactly the props components/Arbetsvy.tsx draws, and nothing else. */
export type Arbete = {
  rader: string[];
  kandidater: { namn: string; url: string; klar: boolean }[];
  foretag: string | null;
};

export type SparadKorning = {
  id: string;
  skapad: string;
  andrad: string;
  url: string;
  namn: string | null;
  status: KorStatus;
  fel: string | null;
  arbete: Arbete;
};

/** What a reloaded page needs, without the columns it never reads. */
export type Statussvar = { status: KorStatus; arbete: Arbete; fel: string | null };

/**
 * One write every five seconds, whether or not anything changed. A run produces
 * around sixty events and its slowest stage is silent for half a minute, so
 * writing per event would be a round-trip per line while still leaving a reader
 * unable to tell a thinking run from a dead one. A fixed pulse does both jobs
 * with roughly twenty-five small updates per run.
 */
const PULS_MS = 5_000;

/** Three missed pulses. Below that a slow Supabase write reads as a death. */
const DOD_EFTER_MS = 45_000;

/** Vercel kills the function at 300s, and a killed function writes nothing. */
const TAK_MS = 330_000;

/** The working view shows the last nine lines; the rest is scrollback. */
const MAX_RADER = 200;

const DOD_TEXT = "The analysis stopped before it finished. Nothing was saved.";

function nu(): string {
  return new Date().toISOString();
}

function tomtArbete(): Arbete {
  return { rader: [], kandidater: [], foretag: null };
}

/**
 * Persistence is optional, exactly as in lib/rapporter.ts: without Supabase keys
 * there is no durable URL, and the stream still works.
 */
export async function startaKorning(url: string): Promise<string | null> {
  const klient = db();
  if (!klient) return null;

  // Minted here rather than by the database because the finished report is
  // stored under this same id. Letting Postgres choose would mean the id only
  // exists once there is a report — which is two minutes after we needed it.
  const id = crypto.randomUUID();
  const { error } = await klient
    .from("koll_korningar")
    .insert({ id, url, status: "kor", arbete: tomtArbete() });

  if (error) return null;
  return id;
}

/**
 * The finished report, under the run's own id. lib/rapporter.sparaRapport lets
 * the database mint one, which is too late here: the address was handed out
 * before the agent had read a single page.
 */
export async function sparaSlutrapport(id: string, rapport: Rapport): Promise<string | null> {
  const klient = db();
  if (!klient) return null;
  const { error } = await klient.from("koll_rapporter").insert({
    id,
    url: rapport.egen.url,
    namn: rapport.egen.namn,
    rapport,
    bevakas: false,
  });
  if (error) return null;
  return id;
}

export type Skrivare = {
  notera: (h: Handelse) => void;
  avsluta: (status: KorStatus, fel?: string) => Promise<void>;
};

/**
 * Follows a run and keeps its row current. Every method is a no-op when there
 * is no id, so the route reads the same with and without Supabase.
 */
export function skapaSkrivare(id: string | null): Skrivare {
  const arbete = tomtArbete();
  let namn: string | null = null;
  let smutsig = false;
  let skriver = false;
  let avslutad = false;

  async function skriv(): Promise<void> {
    // One write at a time: a slow update must not queue three more behind it.
    if (!id || skriver || avslutad) return;
    const klient = db();
    if (!klient) return;

    skriver = true;
    const vad = smutsig ? { andrad: nu(), arbete, namn } : { andrad: nu() };
    smutsig = false;
    // A lost progress write is not worth failing the run over — the report is
    // the product, the progress is a courtesy to whoever reloaded.
    const { error } = await klient.from("koll_korningar").update(vad).eq("id", id);
    if (error) smutsig = true;
    skriver = false;
  }

  const puls = id ? setInterval(() => void skriv(), PULS_MS) : null;

  return {
    notera(h) {
      switch (h.typ) {
        case "steg":
          arbete.rader.push(h.text);
          if (arbete.rader.length > MAX_RADER) arbete.rader.splice(0, arbete.rader.length - MAX_RADER);
          break;
        case "profil":
          arbete.foretag = h.egen.namn;
          namn = h.egen.namn;
          break;
        case "kandidat":
          if (!arbete.kandidater.some((k) => k.url === h.url)) {
            arbete.kandidater.push({ namn: h.namn, url: h.url, klar: false });
          }
          break;
        case "konkurrent":
          for (const k of arbete.kandidater) {
            if (k.url === h.konkurrent.url) k.klar = true;
          }
          break;
        default:
          // klar and fel are the caller's business — they decide the status.
          return;
      }
      smutsig = true;
    },

    async avsluta(status, fel) {
      if (avslutad) return;
      avslutad = true;
      if (puls) clearInterval(puls);
      if (!id) return;
      const klient = db();
      if (!klient) return;
      await klient
        .from("koll_korningar")
        .update({ status, fel: fel ?? null, andrad: nu(), arbete, namn })
        .eq("id", id);
    },
  };
}

/** A run that stopped writing has no one left to mark it failed. */
export function arDod(k: SparadKorning): boolean {
  const nuMs = Date.now();
  return nuMs - Date.parse(k.andrad) > DOD_EFTER_MS || nuMs - Date.parse(k.skapad) > TAK_MS;
}

export async function hamtaKorning(id: string): Promise<SparadKorning | null> {
  const klient = db();
  if (!klient) return null;
  const { data, error } = await klient
    .from("koll_korningar")
    .select("id, skapad, andrad, url, namn, status, fel, arbete")
    .eq("id", id)
    .single();
  if (error || !data) return null;

  // A row written before this column had a shape, or a partial write, must not
  // take the working view down with it.
  const rad = data as SparadKorning;
  const korning: SparadKorning = { ...rad, arbete: { ...tomtArbete(), ...rad.arbete } };
  if (korning.status !== "kor" || !arDod(korning)) return korning;

  // The process that owned this run is gone, so a reader is the only thing that
  // will ever look at the row again. Write the verdict down rather than letting
  // the next reader re-derive it — and never leave the page claiming to work.
  const dod: SparadKorning = { ...korning, status: "fel", fel: korning.fel ?? DOD_TEXT };
  await klient.from("koll_korningar").update({ status: "fel", fel: dod.fel }).eq("id", id);
  return dod;
}
