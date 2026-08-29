import { djupdyk } from "@/lib/agent/djupdyk";
import { arSvensk } from "@/lib/agent/sprak";
import { hamtaRapport, uppdateraRapport } from "@/lib/rapporter";
import type { DjupHandelse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Five researchers on one competitor, streamed so the wait shows the work. */
export async function POST(req: Request) {
  let indata: { id?: string; url?: string };
  try {
    indata = await req.json();
  } catch {
    return new Response("Invalid request.", { status: 400 });
  }
  const { id, url } = indata;
  if (!id || !url) return new Response("Missing id or url.", { status: 400 });

  const sparad = await hamtaRapport(id);
  if (!sparad) return new Response("No such report.", { status: 404 });

  const konkurrent = sparad.rapport.konkurrenter.find((k) => k.url === url);
  if (!konkurrent) return new Response("That competitor is not in this report.", { status: 404 });

  const kodare = new TextEncoder();
  const strom = new ReadableStream({
    async start(styr) {
      const skicka = (h: DjupHandelse) =>
        styr.enqueue(kodare.encode(`data: ${JSON.stringify(h)}\n\n`));

      try {
        for await (const handelse of djupdyk(
          sparad.rapport.egen,
          konkurrent,
          arSvensk(sparad.rapport.egen),
        )) {
          if (handelse.typ === "klar") {
            // Persist it: a deep dive costs real research and the share link
            // should carry it.
            await uppdateraRapport(id, {
              ...sparad.rapport,
              konkurrenter: sparad.rapport.konkurrenter.map((k) =>
                k.url === url ? { ...k, djup: handelse.djup } : k,
              ),
            });
          }
          skicka(handelse);
        }
      } catch (e) {
        skicka({ typ: "fel", text: e instanceof Error ? e.message : "Something went wrong." });
      } finally {
        styr.close();
      }
    },
  });

  return new Response(strom, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
