import { koraKontroll } from "@/lib/agent/kontroll";
import { hamtaRapport, loggaForandringar, uppdateraRapport } from "@/lib/rapporter";

export const runtime = "nodejs";
export const maxDuration = 300;

/** "Kör kontroll nu" — proves the monitoring loop without waiting for a cron. */
export async function POST(req: Request) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return new Response("Missing id.", { status: 400 });

  const sparad = await hamtaRapport(id);
  if (!sparad) return new Response("No such report.", { status: 404 });

  const { forandringar, rapport, baslinjeAndrad } = await koraKontroll(sparad.rapport);
  await loggaForandringar(id, forandringar);
  // Re-baseline whenever a page moved, reported or not, so the next check does
  // not re-read the same churn.
  if (baslinjeAndrad) await uppdateraRapport(id, rapport);

  return Response.json({ forandringar });
}
