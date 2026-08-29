import { db } from "./db";
import type { Forandring } from "./types";

/**
 * The first read of koll_forandringar. Nothing has ever read it — the table has
 * only been written to, by the Check now button — so this is where monitoring
 * stops being a proof of concept and becomes something a customer returns for.
 */
export async function hamtaForandringar(
  rapportId: string,
  tak = 40,
): Promise<Forandring[]> {
  const klient = db();
  if (!klient) return [];

  const { data, error } = await klient
    .from("koll_forandringar")
    .select("konkurrent, url, typ, vad, upptackt")
    .eq("rapport_id", rapportId)
    .order("upptackt", { ascending: false })
    .limit(tak);

  if (error || !data) return [];
  return data as Forandring[];
}

/** What we watch, so an empty feed can say what it has been watching. */
export function bevakningsomfang(sidor: number, konkurrenter: number) {
  return { sidor, konkurrenter };
}
