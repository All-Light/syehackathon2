import { backaHistorik } from "@/lib/agent/historik";
import { hamtaForandringar } from "@/lib/bevakning";
import { hamtaRapport, loggaForandringar } from "@/lib/rapporter";
import type { Forandring } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Build the change feed from the Internet Archive, once, for a report that has
 * no history of its own. Monitoring can only show what changed after a customer
 * arrived; the archive was already watching.
 */
export async function POST(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return new Response("Missing id.", { status: 400 });

  const sparad = await hamtaRapport(id);
  if (!sparad) return new Response("No such report.", { status: 404 });

  // The archive does not change retroactively, so there is nothing to gain from
  // paying for this twice.
  const befintliga = await hamtaForandringar(id, 200);
  if (befintliga.some((f) => f.ursprung === "arkiv")) {
    return Response.json({ forandringar: [] as Forandring[], redanGjort: true });
  }

  const forandringar = await backaHistorik(sparad.rapport);
  await loggaForandringar(id, forandringar);

  return Response.json({ forandringar });
}
