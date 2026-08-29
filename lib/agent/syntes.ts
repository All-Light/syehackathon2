import { z } from "zod";
import { struktur } from "../llm";
import type { Foretag, Konkurrent, Namngiven, Rapport } from "../types";
import { enPerKalla } from "../citat";
import { sprakFor } from "./sprak";

const Insikt = z.object({
  rubrik: z.string(),
  text: z.string(),
  konkurrent: z.string().nullable(),
  citat: z.string().nullable(),
  kallURL: z.string().nullable(),
});

const Schema = z.object({
  sammanfattning: z.string(),
  hot: z.array(Insikt),
  luckor: z.array(Insikt),
  atgarder: z.array(z.string()).min(1),
});

function beskriv(k: Konkurrent): string {
  const priser = k.priser.length
    ? k.priser
        .map((p) => `${p.namn}: ${p.pris}${p.period ? ` / ${p.period}` : ""} [${p.kalla.url}]`)
        .join("; ")
    : "no published price";
  const org = k.orgdata
    ? `Revenue ${k.orgdata.omsattningTkr ?? "?"} tkr (${k.orgdata.ar ?? "?"}), ` +
      `${k.orgdata.anstallda ?? "?"} employees`
    : "no public accounts found";

  return `## ${k.namn} (${k.url})
Positioning: ${k.positionering}
Audience: ${k.malgrupp}
Prices: ${priser}
Features: ${k.funktioner.join(", ") || "—"}
Strengths: ${k.styrkor.join(", ") || "—"}
Weaknesses: ${k.svagheter.join(", ") || "—"}
Company data: ${org}`;
}

/** Step 04. Judgment, not summary. Three actions, not fifteen observations. */
export async function syntetisera(
  egen: Foretag,
  konkurrenter: Konkurrent[],
  ovriga: Namngiven[] = [],
): Promise<Rapport> {
  const p = `You are an adviser who has just gone through a company's competitors for them.
You are speaking to the owner. Be concrete, brief and honest.
${sprakFor(egen)}

# The company you are advising
${egen.namn} (${egen.url})
Sells: ${egen.vadNiSaljer}
To: ${egen.malgrupp}
Pricing model: ${egen.prismodell}
Market: ${egen.geografi}

# The competitors, read from their own pages
${konkurrenter.map(beskriv).join("\n\n")}

# Task
- "sammanfattning": ONE sentence, at most 100 characters. It is shown as the headline.
- "hot": where the competitors are stronger. At most 4.
- "luckor": where ${egen.namn} can attack — something none of them do, or do badly. At most 4.
- "atgarder": exactly 3 things to do this week. Concrete and doable for a small
  company. Not "review your positioning" but "put your price on the homepage —
  two of the three competitors hide theirs".
- "citat" and "kallURL": a verbatim quote and URL from the material above that
  supports the claim, when one exists. Otherwise null. NEVER invent a quote.
- A quote is evidence, not content. Keep every "citat" under 20 words, in the
  words of the page, and never more than one quote from the same page.
- If you are not confident which page a statement came from, set the source to
  null. An unattributed finding is honest; a guessed attribution is not.
- Never reproduce a page's text at length. Summarise in your own words and let
  the short quote carry the proof.

Answer with ONLY valid JSON, no prose, no markdown fence:
{"sammanfattning":"","hot":[{"rubrik":"","text":"","konkurrent":null,"citat":null,"kallURL":null}],"luckor":[{"rubrik":"","text":"","konkurrent":null,"citat":null,"kallURL":null}],"atgarder":[]}`;

  const ut = await struktur(p, Schema, { timeoutMs: 90_000 });
  const insikt = (i: z.infer<typeof Insikt>) => ({
    rubrik: i.rubrik,
    text: i.text,
    konkurrent: i.konkurrent,
    kalla: i.citat && i.kallURL ? { url: i.kallURL, citat: i.citat } : null,
  });

  return {
    sammanfattning: ut.sammanfattning,
    egen,
    konkurrenter,
    ovriga,
    hot: enPerKalla(ut.hot.slice(0, 4).map(insikt)),
    luckor: enPerKalla(ut.luckor.slice(0, 4).map(insikt)),
    atgarder: ut.atgarder.slice(0, 3),
  };
}
