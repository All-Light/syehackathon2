import { db } from "./db";
import type { Forandring, Rapport } from "./types";

export type SparadRapport = {
  id: string;
  skapad: string;
  url: string;
  namn: string;
  rapport: Rapport;
  bevakas: boolean;
};

/** Persistence is optional: without Supabase keys the report still renders. */
export async function sparaRapport(rapport: Rapport): Promise<string | null> {
  const klient = db();
  if (!klient) return null;

  const { data, error } = await klient
    .from("rapporter")
    .insert({
      url: rapport.egen.url,
      namn: rapport.egen.namn,
      rapport,
      bevakas: false,
    })
    .select("id")
    .single();

  if (error) return null;
  return data.id as string;
}

export async function hamtaRapport(id: string): Promise<SparadRapport | null> {
  const klient = db();
  if (!klient) return null;
  const { data, error } = await klient
    .from("rapporter")
    .select("id, skapad, url, namn, rapport, bevakas")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as SparadRapport;
}

export async function satBevakning(id: string, bevakas: boolean): Promise<boolean> {
  const klient = db();
  if (!klient) return false;
  const { error } = await klient.from("rapporter").update({ bevakas }).eq("id", id);
  return !error;
}

export async function loggaForandringar(
  rapportId: string,
  forandringar: Forandring[],
): Promise<void> {
  const klient = db();
  if (!klient || !forandringar.length) return;
  await klient.from("forandringar").insert(
    forandringar.map((f) => ({ rapport_id: rapportId, ...f })),
  );
}
