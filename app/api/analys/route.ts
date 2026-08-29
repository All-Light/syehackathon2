import { kor } from "@/lib/agent";
import { sparaRapport } from "@/lib/rapporter";
import type { Handelse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Server-sent events. The working view is the demo, so every step the agent
 * takes goes out the moment it happens rather than at the end.
 */
export async function POST(req: Request) {
  let indata: { url?: string; angivna?: string[] };
  try {
    indata = await req.json();
  } catch {
    return new Response("Ogiltig förfrågan.", { status: 400 });
  }

  const url = normalisera(indata.url ?? "");
  if (!url) return new Response("Ange en webbadress.", { status: 400 });

  const kodare = new TextEncoder();
  const strom = new ReadableStream({
    async start(styr) {
      const skicka = (h: Handelse) =>
        styr.enqueue(kodare.encode(`data: ${JSON.stringify(h)}\n\n`));

      try {
        for await (const handelse of kor({ url, angivna: indata.angivna })) {
          if (handelse.typ === "klar") {
            const id = await sparaRapport(handelse.rapport);
            skicka({ ...handelse, id });
          } else {
            skicka(handelse);
          }
        }
      } catch (e) {
        skicka({
          typ: "fel",
          text: e instanceof Error ? e.message : "Något gick fel.",
        });
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

function normalisera(rå: string): string | null {
  const t = rå.trim();
  if (!t) return null;
  try {
    return new URL(t.startsWith("http") ? t : `https://${t}`).toString();
  } catch {
    return null;
  }
}
