import { koraKontroll } from "@/lib/agent/kontroll";
import { hamtaRapport, loggaForandringar } from "@/lib/rapporter";

export const runtime = "nodejs";
export const maxDuration = 300;

/** "Kör kontroll nu" — proves the monitoring loop without waiting for a cron. */
export async function POST(req: Request) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return new Response("Saknar id.", { status: 400 });

  const sparad = await hamtaRapport(id);
  if (!sparad) return new Response("Rapporten finns inte.", { status: 404 });

  const { forandringar } = await koraKontroll(sparad.rapport);
  await loggaForandringar(id, forandringar);

  return Response.json({ forandringar });
}
