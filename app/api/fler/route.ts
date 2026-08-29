import { fleraKonkurrenter } from "@/lib/agent/fler";
import { hamtaRapport, uppdateraRapport } from "@/lib/rapporter";
import type { Namngiven } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/** A second sweep, from different angles, deduped against what we already have. */
export async function POST(req: Request) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return new Response("Missing id.", { status: 400 });

  const sparad = await hamtaRapport(id);
  if (!sparad) return new Response("No such report.", { status: 404 });

  const rapport = sparad.rapport;
  const kanda = [
    ...rapport.konkurrenter,
    ...rapport.ovriga.map((o) => ({ ...o, url: o.url })),
  ] as Parameters<typeof fleraKonkurrenter>[1];

  const nya = await fleraKonkurrenter(rapport.egen, kanda);
  if (!nya.length) return Response.json({ nya: [] as Namngiven[] });

  const tillagda: Namngiven[] = nya.map((k) => ({
    namn: k.namn,
    url: k.url,
    varfor: k.varfor,
    hittadAv: "agenten",
  }));

  await uppdateraRapport(id, {
    ...rapport,
    ovriga: [...rapport.ovriga, ...tillagda],
  });

  return Response.json({ nya: tillagda });
}
