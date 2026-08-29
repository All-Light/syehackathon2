import { giltigEpost, sparaEpost } from "@/lib/epost";

/**
 * Attaches an address to a report. Storage only — no mail is sent from
 * anywhere in this codebase, so the response never promises delivery.
 */
export async function POST(req: Request) {
  let kropp: { id?: string; epost?: unknown };
  try {
    kropp = (await req.json()) as { id?: string; epost?: unknown };
  } catch {
    return new Response("Bad body.", { status: 400 });
  }

  if (!kropp.id) return new Response("Missing id.", { status: 400 });

  // Validated here as well as in sparaEpost, so that a malformed address can be
  // told apart from a save that failed: they are different sentences to the
  // person reading them, and only one of them is worth retyping.
  const adress = giltigEpost(kropp.epost);
  if (!adress) {
    return Response.json(
      { ok: false, fel: "That does not look like an email address." },
      { status: 400 },
    );
  }

  const epost = await sparaEpost(kropp.id, adress);
  // Deliberately one message for the rest: an unknown report, a deleted one and
  // an unreachable database all leave the reader with the same next move, and
  // telling a stranger which report ids exist is not this endpoint's job.
  if (!epost) {
    return Response.json(
      { ok: false, fel: "Could not attach that address. Please try again." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, epost });
}
