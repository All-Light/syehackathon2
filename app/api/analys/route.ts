import { kor } from "@/lib/agent";
import {
  skapaSkrivare,
  sparaSlutrapport,
  startaKorning,
  type Korningshandelse,
} from "@/lib/korning";
import type { Handelse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Server-sent events. The working view is the demo, so every step the agent
 * takes goes out the moment it happens rather than at the end.
 *
 * The run also owns a row from its first millisecond. A seller demoing this on
 * a phone in a shop loses the tab, the signal or their patience, and a hundred
 * seconds of work that only exists in React state dies with the page.
 */
export async function POST(req: Request) {
  let indata: { url?: string; angivna?: string[] };
  try {
    indata = await req.json();
  } catch {
    return new Response("Invalid request.", { status: 400 });
  }

  const url = normalisera(indata.url ?? "");
  if (!url) return new Response("Enter a web address.", { status: 400 });

  const kodare = new TextEncoder();
  const strom = new ReadableStream({
    async start(styr) {
      // The reader may be gone — locked phone, closed tab — long before the
      // agent is. Losing the reader must not lose the run, because the row is
      // what the shared URL reads from.
      let oppen = true;
      const skicka = (h: Handelse | Korningshandelse) => {
        if (!oppen) return;
        try {
          styr.enqueue(kodare.encode(`data: ${JSON.stringify(h)}\n\n`));
        } catch {
          oppen = false;
        }
      };

      const id = await startaKorning(url);
      const skrivare = skapaSkrivare(id);
      // First out, ahead of any work: the browser needs the address sooner than
      // it needs the first step.
      if (id) skicka({ typ: "korning", id });

      let avslutad = false;
      try {
        for await (const handelse of kor({ url, angivna: indata.angivna })) {
          skrivare.notera(handelse);

          if (handelse.typ === "klar") {
            const sparad = id ? await sparaSlutrapport(id, handelse.rapport) : null;
            // Without the row there is no /r/<id> to send anyone to, so say so
            // rather than leaving the link to 404 for whoever it was sent to.
            await skrivare.avsluta(
              id && !sparad ? "fel" : "klar",
              id && !sparad ? "The report could not be saved." : undefined,
            );
            avslutad = true;
            skicka({ ...handelse, id: sparad });
          } else if (handelse.typ === "fel") {
            await skrivare.avsluta("fel", handelse.text);
            avslutad = true;
            skicka(handelse);
          } else {
            skicka(handelse);
          }
        }
      } catch (e) {
        const text = e instanceof Error ? e.message : "Something went wrong.";
        await skrivare.avsluta("fel", text);
        avslutad = true;
        skicka({ typ: "fel", text });
      } finally {
        // A generator that simply stops would leave the row saying "working"
        // until the staleness cutoff — no reason to make a reader wait for that.
        if (!avslutad) await skrivare.avsluta("fel", "The analysis ended without a report.");
        try {
          styr.close();
        } catch {
          // Already closed by a reader that walked away.
        }
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
