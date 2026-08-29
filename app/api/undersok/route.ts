import { undersokKonkurrent } from "@/lib/agent/undersok";
import { arSvensk } from "@/lib/agent/sprak";
import { hamtaRapport, uppdateraRapport } from "@/lib/rapporter";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Promote one named competitor to a full read, on demand. */
export async function POST(req: Request) {
  const { id, url } = (await req.json()) as { id?: string; url?: string };
  if (!id || !url) return new Response("Missing id or url.", { status: 400 });

  const sparad = await hamtaRapport(id);
  if (!sparad) return new Response("No such report.", { status: 404 });

  const rapport = sparad.rapport;
  const namngiven = rapport.ovriga.find((o) => o.url === url);
  if (!namngiven) return new Response("Not in the list.", { status: 404 });

  const konkurrent = await undersokKonkurrent(
    { namn: namngiven.namn, url: namngiven.url, varfor: namngiven.varfor },
    namngiven.hittadAv,
    arSvensk(rapport.egen),
  );

  const uppdaterad = {
    ...rapport,
    konkurrenter: [...rapport.konkurrenter, konkurrent],
    ovriga: rapport.ovriga.filter((o) => o.url !== url),
  };
  await uppdateraRapport(id, uppdaterad);

  return Response.json({ konkurrent });
}
