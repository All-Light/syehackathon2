import { skrapa, sok } from "@/lib/firecrawl";
import { hamtaOrgdata } from "@/lib/agent/orgdata";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  // Unauthenticated and it spends Firecrawl and Exa credits on every hit, so it
  // stays on the machine it was written for.
  if (process.env.VERCEL_ENV === "production") {
    return new Response("Not available.", { status: 404 });
  }

  const namn = new URL(req.url).searchParams.get("namn") ?? "Visma";
  const steg: Record<string, unknown> = { namn };

  try {
    const traffar = await sok(`${namn} allabolag omsättning anställda`, { limit: 5 });
    steg.traffar = traffar.map((t) => t.url);
    const kandidat = traffar.find((t) =>
      /allabolag\.se|bolagsfakta\.se|ratsit\.se|proff\.se/.test(t.url),
    );
    steg.kandidat = kandidat?.url ?? null;
    if (kandidat) {
      const sida = await skrapa(kandidat.url);
      steg.skrapaOk = !!sida;
      steg.langd = sida?.markdown.length ?? 0;
      steg.utdrag = sida?.markdown.match(/Omsättning[^\n]{0,40}/)?.[0] ?? null;
    }
  } catch (e) {
    steg.fel = e instanceof Error ? e.message : String(e);
  }

  steg.resultat = await hamtaOrgdata(namn);
  return Response.json(steg);
}
