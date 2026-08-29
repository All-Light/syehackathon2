import { arSvensk } from "@/lib/agent/sprak";
import { harElevenLabs, talSyntes } from "@/lib/elevenlabs";
import { hamtaRapport } from "@/lib/rapporter";
import type { Rapport } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Measured against a real report: this voice at these settings speaks about
 *  16 characters a second, so ~950 characters is the minute we promised. */
const TAK_MANUS = 950;

/** Trim to a whole sentence, or failing that a whole word — a briefing that
 *  ends mid-clause sounds like the audio broke. */
function korta(text: string, tak: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= tak) return t;
  const bit = t.slice(0, tak);
  const punkt = Math.max(bit.lastIndexOf(". "), bit.lastIndexOf("? "), bit.lastIndexOf("! "));
  if (punkt > tak * 0.5) return bit.slice(0, punkt + 1);
  return `${bit.slice(0, bit.lastIndexOf(" "))}…`;
}

/** Registry figures arrive in tkr. Nobody says "forty-five thousand tkr" out
 *  loud, so convert to the unit a person would actually speak. */
function omsattning(tkr: number, svensk: boolean): string {
  if (tkr >= 1000) {
    const mkr = tkr >= 10_000 ? Math.round(tkr / 1000) : Math.round(tkr / 100) / 10;
    return svensk ? `${mkr} miljoner kronor` : `${mkr} million kronor`;
  }
  return svensk ? `${Math.round(tkr)} tusen kronor` : `${Math.round(tkr)} thousand kronor`;
}

/**
 * Templated rather than model-written, deliberately. The prose in the report is
 * already LLM output; running it through a second model to be "made spoken"
 * adds five to fifteen seconds in front of a play button and a second way for
 * the demo to fail, and buys nothing the connective phrasing here does not.
 */
function byggManus(rapport: Rapport): string {
  const svensk = arSvensk(rapport.egen);
  const rader: string[] = [];
  /** Findings, in descending order of what an owner reacts to. First to be cut. */
  const fynd: string[] = [];

  rader.push(
    svensk
      ? `Hej. Här är din konkurrentgenomgång för ${rapport.egen.namn}. ${korta(rapport.sammanfattning, 170)}`
      : `Right — here's your competitor briefing for ${rapport.egen.namn}. ${korta(rapport.sammanfattning, 170)}`,
  );

  const antal = rapport.konkurrenter.length;
  rader.push(
    svensk
      ? `Vi läste ${antal} konkurrenter på nära håll.`
      : `We read ${antal} competitors closely.`,
  );

  // The two numbers an owner reacts to: what the others charge, and how big the
  // biggest of them actually is. Both only get said when we have a real figure.
  const prissatta = rapport.konkurrenter.filter((k) => k.priser.length > 0).slice(0, 2);
  for (const k of prissatta) {
    const p = k.priser[0];
    const period = p.period ? ` per ${p.period}` : "";
    fynd.push(
      svensk
        ? `${k.namn} tar ${p.pris}${period} för sin ${p.namn}.`
        : `${k.namn} charges ${p.pris}${period} for their ${p.namn}.`,
    );
  }

  const storst = rapport.konkurrenter
    .map((k) => ({ k, oms: k.orgdata?.omsattningTkr ?? 0 }))
    .filter((x) => x.oms > 0)
    .sort((a, b) => b.oms - a.oms)[0];
  if (storst) {
    const { k, oms } = storst;
    const anstallda = k.orgdata?.anstallda
      ? svensk
        ? ` och ${k.orgdata.anstallda} anställda`
        : ` and ${k.orgdata.anstallda} employees`
      : "";
    const ar = k.orgdata?.ar ? ` (${k.orgdata.ar})` : "";
    fynd.push(
      svensk
        ? `Störst av dem är ${k.namn}, med ${omsattning(oms, true)} i omsättning${anstallda}${ar}.`
        : `The biggest of them is ${k.namn}, with ${omsattning(oms, false)} in revenue${anstallda}${ar}.`,
    );
  }

  const hot = rapport.hot[0];
  if (hot) {
    fynd.push(
      svensk
        ? `Det jag skulle hålla ögonen på: ${korta(hot.text, 180)}`
        : `The one I'd keep an eye on: ${korta(hot.text, 180)}`,
    );
  }

  const [a1, a2, a3] = rapport.atgarder.map((a) => korta(a, 140));
  const ordningsord = svensk ? ["Ett,", "Två,", "Och tre,"] : ["One,", "Two,", "And three,"];
  const punkter = [a1, a2, a3]
    .filter(Boolean)
    .map((a, n) => `${ordningsord[n]} ${a.replace(/\.$/, "")}.`)
    .join(" ");
  const atgarder = punkter
    ? svensk
      ? `Tre saker att göra den här veckan. ${punkter}`
      : `Three things to do this week. ${punkter}`
    : "";

  const slut = svensk
    ? "Det var allt. Siffrorna och källorna står i rapporten."
    : "That's it. The figures and the sources are all in the report.";

  // The opening, the actions and the sign-off are the briefing; the findings
  // are what it can afford. So reserve the first three and spend what is left
  // on findings, rather than letting a global trim cut the actions off the end.
  const fast = [...rader, atgarder, slut].filter(Boolean);
  let kvar = TAK_MANUS - fast.reduce((n, r) => n + r.length + 1, 0);
  const valda: string[] = [];
  for (const f of fynd) {
    if (f.length + 1 > kvar) break;
    valda.push(f);
    kvar -= f.length + 1;
  }

  return [...rader, ...valda, atgarder, slut].filter(Boolean).join(" ");
}

/** POST {id} → the report read aloud, in the language the report was written in. */
export async function POST(req: Request) {
  if (!harElevenLabs()) {
    return Response.json({ fel: "Voice is not configured on this deployment." }, { status: 503 });
  }

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return Response.json({ fel: "Missing id." }, { status: 400 });

  const sparad = await hamtaRapport(id);
  if (!sparad) return Response.json({ fel: "No such report." }, { status: 404 });

  const manus = byggManus(sparad.rapport);
  const svensk = arSvensk(sparad.rapport.egen);
  // Characters are the ElevenLabs meter, so log what each play actually costs.
  console.log(`[rost] ${manus.length} characters, ${svensk ? "sv" : "en"}: ${manus}`);

  try {
    const ljud = await talSyntes(manus, { sprak: svensk ? "sv" : "en" });
    return new Response(ljud, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(ljud.byteLength),
        // Cheap to regenerate, and a stale briefing after a re-check is worse
        // than a three-second wait.
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[rost]", e instanceof Error ? e.message : e);
    return Response.json({ fel: "The briefing could not be recorded." }, { status: 502 });
  }
}
