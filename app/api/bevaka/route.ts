import { satBevakning } from "@/lib/rapporter";

export async function POST(req: Request) {
  const { id, bevakas } = (await req.json()) as { id?: string; bevakas?: boolean };
  if (!id) return new Response("Missing id.", { status: 400 });
  const ok = await satBevakning(id, bevakas !== false);
  return Response.json({ ok });
}
