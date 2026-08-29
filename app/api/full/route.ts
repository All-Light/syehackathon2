import { skrivFullrapport } from "@/lib/agent/fullrapport";
import { hamtaRapport, uppdateraRapport } from "@/lib/rapporter";
import type { FullHandelse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * The paid tier. Gated on the report being paid for — except on a development
 * server, where waiting on a Stripe round-trip to test the writing would make
 * the writing impossible to iterate on.
 */
export async function POST(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return new Response("Missing id.", { status: 400 });

  const sparad = await hamtaRapport(id);
  if (!sparad) return new Response("No such report.", { status: 404 });

  const utveckling = process.env.NODE_ENV !== "production";
  if (!sparad.betald && !utveckling) {
    return new Response("This report has not been bought.", { status: 402 });
  }
  if (utveckling && !sparad.betald) {
    console.warn("[full] development server — writing without payment");
  }

  const kodare = new TextEncoder();
  const strom = new ReadableStream({
    async start(styr) {
      const skicka = (h: FullHandelse) =>
        styr.enqueue(kodare.encode(`data: ${JSON.stringify(h)}\n\n`));

      try {
        for await (const handelse of skrivFullrapport(sparad.rapport)) {
          if (handelse.typ === "klar") {
            // Save the deep dives too, not just the report written from them:
            // they are the expensive half, and the summary page shows them.
            await uppdateraRapport(id, {
              ...sparad.rapport,
              konkurrenter: handelse.konkurrenter,
              full: handelse.full,
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
