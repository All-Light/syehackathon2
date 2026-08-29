import { z } from "zod";
import { exaSok, harExa } from "../exa";
import { parallellt, skrapa, sok } from "../firecrawl";
import { skrivandeModell, struktur } from "../llm";
import type {
  Djupdykning,
  DjupHandelse,
  Foretag,
  Konkurrent,
  Vinkel,
  VinkelId,
} from "../types";
import { enPerKalla } from "../citat";
import { sprakInstruktion } from "./sprak";

/**
 * Five researchers, one question each. Splitting the work this way is not
 * decoration: one prompt asked to cover pricing, product, audience, reputation
 * and finances at once answers all five shallowly, and the searches for each
 * are genuinely different queries. They run in parallel, so five angles cost
 * roughly what one does in wall-clock time.
 */
const VINKLAR: {
  id: VinkelId;
  rubrik: string;
  fraga: (k: Konkurrent) => string;
  uppdrag: string;
}[] = [
  {
    id: "affarsmodell",
    rubrik: "Business model",
    fraga: (k) => `${k.namn} pricing packaging how they charge customers`,
    uppdrag:
      "How does this company actually make money? Per seat, per transaction, a flat subscription, services on top, a freemium funnel? What does a customer end up paying in a year, and what makes that number go up?",
  },
  {
    id: "produkt",
    rubrik: "Product",
    fraga: (k) => `${k.namn} features product what it does integrations`,
    uppdrag:
      "What does the product actually do, and what does it deliberately not do? Where is it deep and where is it thin? Note integrations, platforms and anything that locks a customer in.",
  },
  {
    id: "malgrupp",
    rubrik: "Who they sell to",
    fraga: (k) => `${k.namn} customers case study who uses it target market`,
    uppdrag:
      "Who buys this, and how do they reach them? Company size, industry, country. Sales-led or self-serve? Any named customers, partners or channels.",
  },
  {
    id: "rykte",
    rubrik: "What customers say",
    fraga: (k) => `${k.namn} omdömen recension reviews problem klagomål`,
    uppdrag:
      "What do actual users praise and complain about? Recurring complaints are the openings worth knowing about. Be specific and quote where you can.",
  },
  {
    id: "bolag",
    rubrik: "The company",
    fraga: (k) => `${k.namn} företaget grundare anställda omsättning finansiering`,
    uppdrag:
      "How big are they and how fast are they moving? Founding, headcount, revenue, funding, ownership, recent hires or layoffs. Facts with dates.",
  },
];

const FyndSchema = z.object({
  fynd: z.array(
    z.object({
      text: z.string(),
      citat: z.string().nullable(),
      kallURL: z.string().nullable(),
    }),
  ),
});

/** One researcher: search its own question, read what came back, report facts. */
async function koraVinkel(
  vinkel: (typeof VINKLAR)[number],
  konkurrent: Konkurrent,
  svensk: boolean,
): Promise<Vinkel> {
  const fraga = vinkel.fraga(konkurrent);

  let underlag: { url: string; titel: string; text: string }[] = [];
  try {
    if (harExa()) {
      // Exa returns the page text with the results, so a researcher costs one
      // call rather than a search plus four scrapes.
      const traffar = await exaSok(fraga, { antal: 5, text: 2_500 });
      underlag = traffar
        .filter((t) => t.text)
        .map((t) => ({ url: t.url, titel: t.title ?? t.url, text: t.text! }));
    } else {
      const traffar = await sok(fraga, { limit: 4 });
      const sidor = await parallellt(traffar.slice(0, 3), 2, (t) => skrapa(t.url));
      underlag = sidor
        .filter((s) => s !== null)
        .map((s) => ({ url: s!.url, titel: s!.titel, text: s!.markdown.slice(0, 2_500) }));
    }
  } catch (e) {
    console.error(`[djupdyk] ${vinkel.id}:`, e instanceof Error ? e.message : e);
  }

  if (!underlag.length) return { id: vinkel.id, rubrik: vinkel.rubrik, fynd: [] };

  const ut = await struktur(
    `You are one of five researchers looking into a competitor. Your question, and
only yours, is below. Another researcher is covering each of the others, so stay
in your lane and go deep.

# Competitor
${konkurrent.namn} — ${konkurrent.url}
How they present themselves: ${konkurrent.positionering}

# Your question
${vinkel.uppdrag}

# What the search turned up
${underlag.map((u) => `## ${u.titel} — ${u.url}\n${u.text}`).join("\n\n")}

# Task
Report what the material actually supports. Rules:
- At most 6 findings. Fewer is fine. An empty list is fine if the material says nothing.
- Every finding is a specific fact, not a hedge. "Charges 99 kr a month per user"
  beats "has a subscription model".
- "citat" is a verbatim quote from the material above that supports the finding,
  and "kallURL" the page it came from. Both null if you are inferring rather
  than quoting — but never invent a quote.
- Ignore anything that is about a different company with a similar name.

# Quoting
- A quote is evidence, not content. Keep every "citat" under 20 words, in the
  words of the page, and never more than one quote from the same page.
- If you are not confident which page a statement came from, set the source to
  null. An unattributed finding is honest; a guessed attribution is not.
- Never reproduce a page's text at length. Summarise in your own words and let
  the short quote carry the proof.
${sprakInstruktion(svensk)}

Answer with ONLY valid JSON, no prose, no markdown fence:
{"fynd":[{"text":"","citat":null,"kallURL":null}]}`,
    FyndSchema,
    { timeoutMs: 90_000, forsok: 1 },
  ).catch((e) => {
    console.error(`[djupdyk] ${vinkel.id} extraction:`, e instanceof Error ? e.message : e);
    return { fynd: [] };
  });

  return {
    id: vinkel.id,
    rubrik: vinkel.rubrik,
    fynd: enPerKalla(
      ut.fynd.slice(0, 6).map((f) => ({
        text: f.text,
        kalla: f.citat && f.kallURL ? { url: f.kallURL, citat: f.citat } : null,
      })),
    ),
  };
}

const InsiktSchema = z.object({
  rubrik: z.string(),
  text: z.string(),
  citat: z.string().nullable(),
  kallURL: z.string().nullable(),
});

const DossierSchema = z.object({
  sammanfattning: z.string(),
  affarsmodell: z.string(),
  intaktsmodell: z.string(),
  battre: z.array(InsiktSchema),
  samre: z.array(InsiktSchema),
  taktik: z.array(z.string()).min(1),
});

/** The whole deep dive: researchers first, then one writer over what they found. */
export async function* djupdyk(
  egen: Foretag,
  konkurrent: Konkurrent,
  svensk: boolean,
): AsyncGenerator<DjupHandelse> {
  const ko: Vinkel[] = [];

  yield { typ: "steg", text: `Sending five researchers at ${konkurrent.namn}` };

  const arbete = parallellt(VINKLAR, 5, async (v) => {
    const vinkel = await koraVinkel(v, konkurrent, svensk);
    ko.push(vinkel);
    return vinkel;
  });

  // Drain as they finish, so the wait shows five things happening at once.
  for (;;) {
    const klar = await Promise.race([arbete.then(() => true), paus()]);
    while (ko.length) {
      const v = ko.shift()!;
      yield { typ: "steg", text: `${v.rubrik}: ${v.fynd.length} findings` };
      yield { typ: "vinkel", vinkel: v };
    }
    if (klar === true) break;
  }

  const vinklar = (await arbete).filter((v) => v.fynd.length > 0);
  if (!vinklar.length) {
    yield { typ: "fel", text: `Found nothing solid on ${konkurrent.namn}.` };
    return;
  }

  yield { typ: "steg", text: "Writing up what they found" };

  const dossier = await struktur(
    `You are writing a competitor dossier for the owner of a company. Five
researchers have each looked into a different aspect of one competitor. Their
findings are below. Turn them into a picture of how that competitor actually
runs as a business, and where it beats or loses to the company you advise.
${sprakInstruktion(svensk)}

# The company you advise
${egen.namn} (${egen.url})
Sells: ${egen.vadNiSaljer}
To: ${egen.malgrupp}
Pricing model: ${egen.prismodell}
Market: ${egen.geografi}

# The competitor
${konkurrent.namn} — ${konkurrent.url}
Positioning: ${konkurrent.positionering}
Audience: ${konkurrent.malgrupp}
Published prices: ${
      konkurrent.priser.length
        ? konkurrent.priser.map((p) => `${p.namn} ${p.pris}${p.period ? `/${p.period}` : ""}`).join("; ")
        : "none published"
    }
${
  konkurrent.orgdata
    ? `Public accounts: revenue ${konkurrent.orgdata.omsattningTkr ?? "?"} tkr (${konkurrent.orgdata.ar ?? "?"}), ${konkurrent.orgdata.anstallda ?? "?"} employees`
    : "Public accounts: none found"
}

# What the researchers found
${vinklar
  .map((v) => `## ${v.rubrik}\n${v.fynd.map((f) => `- ${f.text}${f.kalla ? ` [${f.kalla.url}]` : ""}`).join("\n")}`)
  .join("\n\n")}

# Task
- "sammanfattning": ONE sentence, at most 110 characters. The single most useful
  thing the owner should take away.
- "affarsmodell": how this competitor runs as a business — who they serve, how
  they reach them, what the shape of the company is. Two to four sentences of
  plain prose, not bullets.
- "intaktsmodell": specifically how the money arrives, and what makes a customer
  pay more over time. Two sentences.
- "battre": where this competitor genuinely beats ${egen.namn}. Be honest; an
  owner who is flattered here makes a bad decision.
- "samre": where ${egen.namn} beats them.
- "taktik": two to four things ${egen.namn} could do about this
  competitor specifically. Concrete enough to start on Monday.
- "citat"/"kallURL": a verbatim quote and its URL from the findings above where
  one supports the point, otherwise null. Never invent a quote.
- Where the researchers found nothing on a point, say so rather than filling the
  gap with something plausible.

Answer with ONLY valid JSON, no prose, no markdown fence:
{"sammanfattning":"","affarsmodell":"","intaktsmodell":"","battre":[{"rubrik":"","text":"","citat":null,"kallURL":null}],"samre":[{"rubrik":"","text":"","citat":null,"kallURL":null}],"taktik":[]}`,
    DossierSchema,
    { timeoutMs: 180_000, niva: "skrivande" },
  );

  const insikt = (i: z.infer<typeof InsiktSchema>) => ({
    rubrik: i.rubrik,
    text: i.text,
    konkurrent: null,
    kalla: i.citat && i.kallURL ? { url: i.kallURL, citat: i.citat } : null,
  });

  const djup: Djupdykning = {
    skapad: new Date().toISOString(),
    sammanfattning: dossier.sammanfattning,
    affarsmodell: dossier.affarsmodell,
    intaktsmodell: dossier.intaktsmodell,
    battre: enPerKalla(dossier.battre.slice(0, 5).map(insikt)),
    samre: enPerKalla(dossier.samre.slice(0, 5).map(insikt)),
    taktik: dossier.taktik.slice(0, 4),
    vinklar,
    skrivenAv: await skrivandeModell(),
  };

  yield { typ: "klar", djup };
}

function paus(): Promise<false> {
  return new Promise((k) => setTimeout(() => k(false), 400));
}
