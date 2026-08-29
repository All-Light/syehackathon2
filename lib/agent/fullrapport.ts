import { z } from "zod";
import { enPerKalla } from "../citat";
import { parallellt } from "../firecrawl";
import { skrivandeModell, struktur } from "../llm";
import type {
  Avsnitt,
  Bokslutsar,
  FullHandelse,
  Fullrapport,
  Kalla,
  Konkurrent,
  Position,
  Rapport,
  Tillit,
} from "../types";
import { djupdyk } from "./djupdyk";
import { byggSwot } from "./swot";
import { arSvensk, sprakInstruktion } from "./sprak";

/**
 * Three arguments, each written by its own pass.
 *
 * MECE: every competitor fact belongs to exactly one of price, capability or
 * momentum, so the three together cover the ground without overlapping. A
 * single prompt asked to produce "the analysis" returns a list of observations
 * in the order it happened to find them; three focused prompts return three
 * arguments, and the conclusion is then written over them rather than before.
 */
const ARGUMENT: { id: string; rubrik: string; uppdrag: string }[] = [
  {
    id: "pris",
    rubrik: "Price and packaging",
    uppdrag:
      "What does this market charge, how is it packaged, and where does the company you advise sit in that spread? Who publishes a price and who hides one, what a customer actually pays in a year, and what makes that number rise.",
  },
  {
    id: "formaga",
    rubrik: "Capability and scope",
    uppdrag:
      "What can these products do, where is each deep and each thin, and what does the company you advise have that none of them has? Distinguish a genuine capability gap from a marketing difference.",
  },
  {
    id: "rorelse",
    rubrik: "Momentum",
    uppdrag:
      "Who is growing and who is not, read from public filings, headcount, hiring, funding and what they have shipped recently. Say plainly where the evidence runs out — a competitor with no filings is not thereby small.",
  },
  {
    id: "marknad",
    rubrik: "How the market is arranged",
    uppdrag:
      "How does this market divide up, and who serves which part of it? Which competitors cluster together and which sit alone; where the crowding is and where nobody is; who a customer actually chooses between when they are choosing. Name the segments in the market's own terms, not in abstractions.",
  },
  {
    id: "drag",
    rubrik: "Where you win, and what it would take",
    uppdrag:
      "Given everything the other sections establish, where can the company you advise actually win, and what would it cost them to do it? Be specific about the move and honest about the price of making it. This is the section the owner acts on, so no hedging and no generic advice that would fit any company.",
  },
];

const AvsnittSchema = z.object({
  rubrik: z.string(),
  brodtext: z.string(),
  tillit: z.enum(["verifierat", "harlett", "bedomning"]),
  kallor: z.array(z.object({ citat: z.string(), url: z.string() })),
});

/** "99 kr/mån" and "199 kr per månad" are the same number to a reader. */
function tolkaPris(pris: string, period: string | null): number | null {
  const text = `${pris} ${period ?? ""}`.toLowerCase();
  const siffra = pris.match(/(\d[\d\s ]*(?:[.,]\d+)?)/);
  if (!siffra) return null;
  const tal = Number(siffra[1].replace(/[\s ]/g, "").replace(",", "."));
  if (!Number.isFinite(tal) || tal <= 0) return null;

  // "49 kr/månad (årsvis)" is 49 a month billed yearly, not 49 a year. Month
  // wins the tie, and the period field is more trustworthy than a parenthetical
  // in the price string.
  const manad = /mån|month|mnd|\/mo\b/;
  const ar = /år|year|annual|\/yr\b/;
  if (period) {
    const p = period.toLowerCase();
    if (manad.test(p)) return tal;
    if (ar.test(p)) return Math.round(tal / 12);
  }
  if (manad.test(text)) return tal;
  if (ar.test(text)) return Math.round(tal / 12);
  return null;
}

/**
 * The median published price, not the cheapest.
 *
 * Fortnox publishes a 9 kr add-on alongside 209 and 349 kr packages; taking the
 * first or lowest number put them below every competitor on the axis, which is
 * the opposite of true. The median of what a company publishes is the closest
 * honest single number for "what they charge".
 */
function prisPerManad(k: Konkurrent): number | null {
  const tal = k.priser
    .map((p) => tolkaPris(p.pris, p.period))
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
  if (!tal.length) return null;
  return tal[Math.floor(tal.length / 2)];
}

/**
 * Breadth is relative, and ranked rather than scored.
 *
 * An absolute count does not work: extraction caps the feature list, so every
 * competitor came out identical and the axis carried no information. What a
 * strategic-group map actually shows is who is broader than whom, so rank them
 * within this set and say so on the axis. Ties share a rank.
 */
function positioner(konkurrenter: Konkurrent[]): Position[] {
  const rå = konkurrenter.map((k) => ({
    k,
    poang:
      k.funktioner.length +
      (k.djup?.vinklar.find((v) => v.id === "produkt")?.fynd.length ?? 0) +
      (k.priser.length ? 1 : 0),
  }));

  const stigande = [...new Set(rå.map((r) => r.poang))].sort((a, b) => a - b);
  const steg = Math.max(1, stigande.length - 1);

  return rå.map(({ k, poang }) => ({
    konkurrent: k.namn,
    prisPerManad: prisPerManad(k),
    bredd: 1 + Math.round((stigande.indexOf(poang) / steg) * 4),
    omsattningTkr: k.orgdata?.omsattningTkr ?? null,
  }));
}

/** Everything we know about one competitor, flattened for a writing prompt. */
function underlag(k: Konkurrent): string {
  const rader = [
    `## ${k.namn} (${k.url})`,
    `Positioning: ${k.positionering}`,
    `Audience: ${k.malgrupp}`,
    `Prices: ${
      k.priser.length
        ? k.priser.map((p) => `${p.namn} ${p.pris}${p.period ? `/${p.period}` : ""} [${p.kalla.url}]`).join("; ")
        : "none published"
    }`,
    `Features: ${k.funktioner.join(", ") || "—"}`,
    `Strengths: ${k.styrkor.join(", ") || "—"}`,
    `Weaknesses: ${k.svagheter.join(", ") || "—"}`,
    k.orgdata
      ? `Filings: revenue ${k.orgdata.omsattningTkr ?? "?"} tkr (${k.orgdata.ar ?? "?"}), ${k.orgdata.anstallda ?? "?"} employees [${k.orgdata.kalla?.url ?? ""}]`
      : "Filings: none found under this name",
    k.orgdata?.historik.length
      ? `Filed revenue by year (tkr): ${k.orgdata.historik
          .map((h) => `${h.ar} ${h.omsattningTkr ?? "?"}`)
          .join(", ")}${
          k.orgdata.tillvaxtProcent !== null
            ? `. Latest year-on-year: ${k.orgdata.tillvaxtProcent}%`
            : ""
        }`
      : "Filed revenue by year: not available",
  ];

  if (k.djup) {
    rader.push(`Business model: ${k.djup.affarsmodell}`);
    rader.push(`Revenue model: ${k.djup.intaktsmodell}`);
    for (const v of k.djup.vinklar) {
      rader.push(
        `${v.rubrik}: ${v.fynd.map((f) => `${f.text}${f.kalla ? ` [${f.kalla.url}]` : ""}`).join(" · ")}`,
      );
    }
  }
  return rader.join("\n");
}

async function skrivAvsnitt(
  arg: (typeof ARGUMENT)[number],
  rapport: Rapport,
  svensk: boolean,
): Promise<Avsnitt> {
  const ut = await struktur(
    `You are writing one section of a competitor report for the owner of a company.
Another writer is covering each of the other sections, so stay strictly on yours.
${sprakInstruktion(svensk)}

# The company you advise
${rapport.egen.namn} (${rapport.egen.url})
Sells: ${rapport.egen.vadNiSaljer}
To: ${rapport.egen.malgrupp}
Pricing model: ${rapport.egen.prismodell}
Market: ${rapport.egen.geografi}

# Your section
${arg.rubrik} — ${arg.uppdrag}

${
      rapport.egen_djup
        ? `# ${rapport.egen.namn} — read the same way, from their own pages\n${underlag(rapport.egen_djup)}\n`
        : ""
    }
# Everything we know about the competitors
${rapport.konkurrenter.map(underlag).join("\n\n")}

# How to write it
- "rubrik" states the CONCLUSION, not the topic. "Three of four hide their price,
  which is your opening" — not "Pricing analysis". A heading that stays true when
  the underlying numbers change is the wrong heading.
- "brodtext": 500-750 words of prose the owner can act on. This is a section of
  a printed report, not a summary of one — argue the point properly, work
  through the specific competitors by name, and follow each claim to what it
  means for them. Every number carries a consequence. Write in paragraphs; no
  bullet lists and no headings inside the text.
- "tillit": "verifierat" if the section rests on quoted pages or filings;
  "harlett" if it follows from combining verified facts; "bedomning" if it is
  your reading and a reasonable person could disagree. Be honest — a section
  marked bedomning is more useful than a wrong one marked verifierat.
- "kallor": up to 4 supporting quotes with their URLs, taken verbatim from the
  material above. A quote is under 20 words, and never two from the same page.
  Empty list if the section rests on judgement rather than a quotable line.
- Where the evidence does not reach, say so in the prose. An owner who is told
  what we could not find out trusts what we did.

Answer with ONLY valid JSON, no prose, no markdown fence:
{"rubrik":"","brodtext":"","tillit":"verifierat","kallor":[{"citat":"","url":""}]}`,
    AvsnittSchema,
    { timeoutMs: 200_000, niva: "skrivande", forsok: 1 },
  ).catch((e) => {
    console.error(`[full] ${arg.id}:`, e instanceof Error ? e.message : e);
    return null;
  });

  if (!ut) {
    return {
      rubrik: `${arg.rubrik} — not enough evidence to write this section`,
      brodtext:
        "This section could not be written from the material gathered. It is left in rather than removed, because a gap you can see is worth more than a gap you cannot.",
      tillit: "bedomning" as Tillit,
      kallor: [],
    };
  }

  return {
    rubrik: ut.rubrik,
    brodtext: ut.brodtext,
    tillit: ut.tillit,
    kallor: enPerKalla(
      ut.kallor.slice(0, 4).map((k) => ({ kalla: { url: k.url, citat: k.citat } })),
    )
      .map((x) => x.kalla)
      .filter((k): k is Kalla => k !== null),
  };
}

const ToppSchema = z.object({
  slutsats: z.string(),
  ogonblick: z.array(z.string()).min(3),
});

/**
 * The whole paid report. Deep dives first where they are missing, then the
 * three arguments in parallel, then the conclusion written over them — the
 * governing answer is written last precisely so that it answers the evidence
 * rather than leading it.
 */
export async function* skrivFullrapport(
  rapport: Rapport,
): AsyncGenerator<FullHandelse> {
  const svensk = arSvensk(rapport.egen);
  const konkurrenter = [...rapport.konkurrenter];

  const saknar = konkurrenter.filter((k) => !k.djup);
  if (saknar.length) {
    yield {
      typ: "steg",
      text: `Researching ${saknar.length} competitor${saknar.length > 1 ? "s" : ""} in depth first`,
    };

    // Fifteen researchers are about to work for two minutes. Swallowing their
    // progress leaves the reader watching four lines crawl past, so pass it up:
    // the work is the only thing that makes the wait tolerable.
    const ko: string[] = [];
    const arbete = parallellt(saknar, 3, async (k) => {
      for await (const h of djupdyk(rapport.egen, k, svensk)) {
        if (h.typ === "steg") ko.push(`${k.namn} · ${h.text}`);
        if (h.typ === "vinkel") {
          ko.push(`${k.namn} · ${h.vinkel.rubrik}: ${h.vinkel.fynd.length} findings`);
        }
        if (h.typ === "klar") {
          const i = konkurrenter.findIndex((x) => x.url === k.url);
          if (i >= 0) konkurrenter[i] = { ...konkurrenter[i], djup: h.djup };
          ko.push(`${k.namn} · done`);
        }
      }
    });

    for (;;) {
      const klar = await Promise.race([arbete.then(() => true), paus()]);
      while (ko.length) yield { typ: "steg", text: ko.shift()! };
      if (klar === true) break;
    }
    yield { typ: "steg", text: "Deep research done" };
  }

  const medDjup: Rapport = { ...rapport, konkurrenter };

  yield { typ: "steg", text: `Writing the ${ARGUMENT.length} arguments` };
  for (const a of ARGUMENT) yield { typ: "steg", text: `Writing: ${a.rubrik}` };

  const kön: { avsnitt: Avsnitt; etikett: string }[] = [];
  const skrivning = parallellt(ARGUMENT, ARGUMENT.length, async (a) => {
    const avsnitt = await skrivAvsnitt(a, medDjup, svensk);
    kön.push({ avsnitt, etikett: a.rubrik });
    return avsnitt;
  });

  for (;;) {
    const klar = await Promise.race([skrivning.then(() => true), paus()]);
    while (kön.length) {
      const { avsnitt, etikett } = kön.shift()!;
      yield { typ: "steg", text: `Done: ${etikett}` };
      yield { typ: "avsnitt", avsnitt };
    }
    if (klar === true) break;
  }

  const avsnitt = await skrivning;

  yield { typ: "steg", text: "Drawing the conclusion" };

  const topp = await struktur(
    `You are finishing a competitor report by writing the one sentence it exists to
support, and the handful of lines an owner reads if they read nothing else.
${sprakInstruktion(svensk)}

# The company
${rapport.egen.namn} — ${rapport.egen.vadNiSaljer}, sold to ${rapport.egen.malgrupp} in ${rapport.egen.geografi}

# The arguments, already written
${avsnitt.map((a) => `## ${a.rubrik} (${a.tillit})\n${a.brodtext}`).join("\n\n")}

# What was already agreed
Headline: ${rapport.sammanfattning}
This week's actions: ${rapport.atgarder.join(" · ")}

# Task
- "slutsats": ONE sentence, at most 160 characters. The single governing claim
  the three arguments above support. It must be a claim someone could disagree
  with — "there is competition in this market" is not one.
- "ogonblick": 4 or 5 lines. Each is a complete thought with a number or a name
  in it, and each must be traceable to one of the arguments above. This is the
  part an owner reads standing up, so no throat-clearing.
- Do not introduce anything the arguments above do not contain.

Answer with ONLY valid JSON, no prose, no markdown fence:
{"slutsats":"","ogonblick":[]}`,
    ToppSchema,
    { timeoutMs: 120_000, niva: "skrivande" },
  );

  const namngivna = medDjup.ovriga?.length ?? 0;

  const full: Fullrapport = {
    skapad: new Date().toISOString(),
    skrivenAv: await skrivandeModell(),
    slutsats: topp.slutsats,
    ogonblick: topp.ogonblick.slice(0, 6),
    avsnitt,
    // The customer's own company is read by the same instrument as every rival
    // (undersokKonkurrent), so it belongs on the same axes. A map of the market
    // that omits the reader is missing its anchor.
    positioner: positioner(
      rapport.egen_djup ? [rapport.egen_djup, ...konkurrenter] : konkurrenter,
    ),
    swot: byggSwot(konkurrenter),
    tillvaxt: konkurrenter
      .filter((k) => (k.orgdata?.historik.length ?? 0) >= 2)
      .map((k) => ({
        konkurrent: k.namn,
        serie: k.orgdata!.historik as Bokslutsar[],
      })),
    // Stated in code, not written by a model: the reader needs the real rule.
    urval: `The agent searched for companies selling ${rapport.egen.vadNiSaljer.toLowerCase()} to ${rapport.egen.malgrupp.toLowerCase()}, then read the ${konkurrenter.length} it ranked most likely to compete for the same customers${
      namngivna ? `, naming a further ${namngivna} without reading them` : ""
    }. Directories, comparison sites and news articles were excluded. A competitor absent from search results is absent from this report.`,
    metod: `Every price and feature here was read from the competitor's own pages on ${new Date().toLocaleDateString("sv-SE")} and is quoted in the sources. Company figures come from Swedish public filings, which lag the present by up to a year, are not audited by Bolagsverket, and exist only for aktiebolag — a competitor with no figures is not thereby small. Claims are labelled Verified where they rest on a quoted page, Derived where they follow from combining verified facts, and Judgement where a reasonable person could disagree. Revenue by year comes from the accounts each company has filed, five years where five exist; a competitor that files nothing appears in no growth figure, which is a gap in the evidence and not a finding about their size. We do not state a market size: the honest public proxies for it are counts of registered companies, which are not the same thing, and an invented number would undermine everything else here. On the positioning chart, price is the median of what a company publishes — not its cheapest tier, which for a vendor with a low add-on fee would put them below everyone — and breadth is a rank within this set of competitors rather than an absolute score.`,
  };

  yield { typ: "klar", full, konkurrenter };
}

function paus(): Promise<false> {
  return new Promise((k) => setTimeout(() => k(false), 400));
}
