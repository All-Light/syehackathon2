import type { Insikt, Kalla, Konkurrent, Orgdata, Swot, SwotRuta } from "../types";

/**
 * A SWOT per competitor, consolidated rather than written.
 *
 * The four boxes are a famous way to fabricate. Hand a model an empty 2×2 and it
 * fills all four, because an empty box looks like a mistake and a plausible
 * sentence is free. So no model runs in this file. Every bullet is lifted from a
 * typed field some earlier step already populated and already sourced, or it is
 * computed here from figures the report prints elsewhere — and a box with nothing
 * behind it says why, which is the one thing a written SWOT can never do.
 *
 * The provenance map, decided once and applied to every competitor:
 *
 *   Strengths     djup.battre[]        where the researchers found them ahead of us
 *                 djup.vinklar[rykte]  what customers praised (see `sorteraRykte`)
 *                 computed             publishes a price; widest coverage in the set
 *
 *   Weaknesses    djup.samre[]         where the researchers found us ahead of them
 *                 djup.vinklar[rykte]  what customers complained about
 *                 computed             no published price; falling filed revenue;
 *                                      narrowest coverage in the set
 *
 *   Opportunities djup.taktik[]        the moves the deep dive proposed against them
 *                 computed             price position we can act on
 *
 *   Threats       computed             filed growth, filed size, a price that undercuts
 *
 * Strengths and weaknesses are stated about them; opportunities and threats are
 * stated from the reader's side. That asymmetry is deliberate — a "threat to the
 * competitor" and a "threat to you" in the same grid is the reading that makes
 * the four boxes incoherent.
 *
 * The other three research angles (affarsmodell, produkt, malgrupp, bolag) are
 * not mapped in. They are descriptions of how a company works, not claims about
 * advantage, and pouring thirty findings into four boxes would be consolidation
 * in name only. They keep their own section of the report.
 *
 * `k.styrkor` and `k.svagheter` are deliberately left out. Four of each exist for
 * every competitor, they carry no `Kalla`, and their content is largely restated —
 * with a source — by `djup.battre`/`djup.samre` and by the computed price facts.
 * Including them would fill all four boxes for every competitor on unsourced
 * prose, which is exactly the failure this file exists to prevent; it would also
 * mean no quadrant is ever empty, leaving the stated-gap machinery dead code.
 */

type Punkt = {
  text: string;
  kalla: Kalla | null;
  /**
   * Set on the reputation findings only: drop this point if the page behind it
   * is already cited in the same box. See `ruta`.
   */
  baraOmNyKalla?: boolean;
};

/* --------------------------------------------------------------------------
   Numbers. Formatted here rather than in the component because these strings
   are stored with the report and must read the same in ten years.
   -------------------------------------------------------------------------- */

function tal(v: number, decimaler = 0) {
  const [heltal, brak] = v.toFixed(decimaler).split(".");
  return heltal.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (brak ? `.${brak}` : "");
}

/** tkr is unreadable at a billion, so the figure picks its own unit. */
function belopp(tkr: number) {
  const msek = tkr / 1000;
  if (Math.abs(msek) >= 1000) return `${tal(msek / 1000, 2)} bn SEK`;
  if (Math.abs(msek) >= 100) return `${tal(msek)} MSEK`;
  if (Math.abs(msek) < 1) return `${tal(tkr)} tkr`;
  return `${tal(msek, 1)} MSEK`;
}

function procent(v: number) {
  const n = Math.abs(v);
  return `${v >= 0 ? "+" : "−"}${tal(n, n >= 100 ? 0 : 1)}%`;
}

/**
 * "99 kr/mån" and "199 kr per månad" are the same number to a reader.
 *
 * Deliberately a local copy of the reader in `fullrapport.ts` rather than an
 * import: this module is called by that one, and a price only reaches a SWOT box
 * as "they publish one, and where it sits against the others" — a far smaller
 * claim than the positioning map makes. Keeping the two apart means neither can
 * silently change what the other says.
 */
function tolkaPris(pris: string, period: string | null): number | null {
  const per = (period ?? "").toLowerCase();
  const text = `${pris} ${per}`;
  const siffra = text.match(/(\d[\d\s ]*(?:[.,]\d+)?)/);
  if (!siffra) return null;
  const n = Number(siffra[1].replace(/[\s ]/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;

  const manad = /mån|month|mnd/;
  const ar = /år|year|annual/;
  // The period field, where it states a unit, is the company's own answer.
  if (manad.test(per)) return n;
  if (ar.test(per)) return Math.round(n / 12);
  // "49 kr/månad (årsvis)" names both units and means 49 a month, billed for a
  // year. Month wins the tie, or a discount for paying up front comes out
  // twelve times cheaper than it is.
  if (manad.test(text.toLowerCase())) return n;
  if (ar.test(text.toLowerCase())) return Math.round(n / 12);
  return null;
}

/**
 * Growth per year, from the filing itself where the register gave us one and
 * otherwise from the filed series. Never from anything a model said.
 */
function arligTillvaxt(o: Orgdata | null): number | null {
  if (!o) return null;
  if (o.tillvaxtProcent !== null && Number.isFinite(o.tillvaxtProcent)) {
    return o.tillvaxtProcent;
  }
  // Reports stored before the five-year series existed carry no `historik` at all.
  const rader = (o.historik ?? [])
    .filter((r): r is { ar: number; omsattningTkr: number; resultatTkr: number | null } =>
      r?.omsattningTkr !== null && r?.omsattningTkr !== undefined,
    )
    .sort((a, b) => a.ar - b.ar);
  const forsta = rader[0];
  const sista = rader[rader.length - 1];
  if (!forsta || !sista || sista.ar <= forsta.ar || !(forsta.omsattningTkr > 0)) return null;
  return ((sista.omsattningTkr / forsta.omsattningTkr) ** (1 / (sista.ar - forsta.ar)) - 1) * 100;
}

/* --------------------------------------------------------------------------
   What customers said.

   The `rykte` angle is briefed to collect "what users praise and complain
   about", so its findings are not uniformly weakness material — filing the
   whole angle under Weaknesses would print a compliment under that heading.
   Sentiment is not something this file is willing to judge, so it screens on
   plain words instead, in both languages the research is written in, and
   deliberately errs towards using nothing: a finding that matches neither list,
   or both, is left where it already lives, in the deep-dive section. Under-use
   is a cheap error here. Misfiling praise as a weakness is not.
   -------------------------------------------------------------------------- */

const KLAGOMAL = [
  "kritik",
  "klagom",
  "klagar",
  "missnöj",
  "bristfäll",
  "brister",
  "omöjlig",
  "tvingar",
  "tvingas",
  "dold avgift",
  "dolda avgift",
  "för dyr",
  "fungerar inte",
  "fungerade inte",
  "strular",
  "buggar",
  "besvärlig",
  "irriter",
  "straffar",
  "complain",
  "criticis",
  "criticiz",
  "critical of",
  "lacks",
  "lacking",
  "forced to",
  "hidden fee",
  "impossible",
  "too expensive",
  "does not work",
  "doesn't work",
  "buggy",
  "poor support",
  "frustrat",
  "unreliable",
];

const BEROM = [
  "positiv",
  "beröm",
  "uppskatt",
  "nöjd",
  "rekommenderar",
  "hyllar",
  "lovord",
  "kunnig",
  "praise",
  "recommend",
  "satisfied",
  "happy with",
  "excellent",
  "helpful",
  "knowledgeable",
];

function sorteraRykte(k: Konkurrent) {
  const fynd = k.djup?.vinklar.find((v) => v.id === "rykte")?.fynd ?? [];
  const klagomal: Punkt[] = [];
  const berom: Punkt[] = [];
  for (const f of fynd) {
    const t = f.text.toLowerCase();
    const negativt = KLAGOMAL.some((o) => t.includes(o));
    const positivt = BEROM.some((o) => t.includes(o));
    if (negativt && !positivt) {
      klagomal.push({ text: `Customers report: ${f.text}`, kalla: f.kalla, baraOmNyKalla: true });
    } else if (positivt && !negativt) {
      berom.push({ text: `Customers praise: ${f.text}`, kalla: f.kalla, baraOmNyKalla: true });
    }
  }
  return { klagomal, berom };
}

/** The heading states the point; the body is why it holds. Both are already written. */
function franInsikt(i: Insikt): Punkt {
  const rubrik = i.rubrik?.trim();
  return { text: rubrik ? `${rubrik} — ${i.text}` : i.text, kalla: i.kalla };
}

/* --------------------------------------------------------------------------
   The set. Several bullets are comparisons, and a comparison needs everyone.
   -------------------------------------------------------------------------- */

type Underlag = {
  k: Konkurrent;
  /** Median published monthly price, and the page it was published on. */
  pris: { belopp: number; kalla: Kalla } | null;
  /** Lowest and highest published monthly price, for the range in the bullet. */
  spann: { lag: number; hog: number } | null;
  bredd: number;
  omsattningTkr: number | null;
  anstallda: number | null;
  tillvaxt: number | null;
  ar: number | null;
  orgKalla: Kalla | null;
};

function underlag(k: Konkurrent): Underlag {
  const priser = (k.priser ?? [])
    .map((p) => ({ belopp: tolkaPris(p.pris, p.period), kalla: p.kalla }))
    .filter((p): p is { belopp: number; kalla: Kalla } => p.belopp !== null)
    .sort((a, b) => a.belopp - b.belopp);

  return {
    k,
    // The median of what a company publishes, matching the positioning map: the
    // cheapest add-on is not what they charge.
    pris: priser.length ? priser[Math.floor(priser.length / 2)] : null,
    spann: priser.length
      ? { lag: priser[0].belopp, hog: priser[priser.length - 1].belopp }
      : null,
    bredd: k.funktioner?.length ?? 0,
    omsattningTkr: k.orgdata?.omsattningTkr ?? null,
    anstallda: k.orgdata?.anstallda ?? null,
    tillvaxt: arligTillvaxt(k.orgdata ?? null),
    ar: k.orgdata?.ar ?? null,
    orgKalla: k.orgdata?.kalla ?? null,
  };
}

/**
 * Extraction caps the feature list, so a one-item difference is noise rather
 * than breadth. A competitor is only called widest or narrowest when they hold
 * the position alone and by at least two, and only when there are enough
 * competitors for the word to mean anything.
 */
function breddPlats(u: Underlag, alla: Underlag[]): "bredast" | "smalast" | null {
  if (alla.length < 3) return null;
  const varden = [...new Set(alla.map((x) => x.bredd))].sort((a, b) => a - b);
  if (varden.length < 2) return null;
  const ensam = (v: number) => alla.filter((x) => x.bredd === v).length === 1;
  const hogst = varden[varden.length - 1];
  const lagst = varden[0];
  if (u.bredd === hogst && ensam(hogst) && hogst - varden[varden.length - 2] >= 2) return "bredast";
  if (u.bredd === lagst && ensam(lagst) && varden[1] - lagst >= 2) return "smalast";
  return null;
}

/* --------------------------------------------------------------------------
   The register rule.

   `orgdata === null` means we could not match the company in the Swedish
   company register. A foreign parent, a Swedish branch of one, a partnership or
   a sole trader files nothing there. That is a gap in our reach, not a fact
   about the company, and the report's own method section commits to saying so.
   Every figure-derived bullet is therefore built inside this one function, and
   this one function starts by returning nothing when there is no filing — so
   there is no path by which an absent register entry becomes a weakness.
   -------------------------------------------------------------------------- */

function siffror(u: Underlag, alla: Underlag[]) {
  const svagheter: Punkt[] = [];
  const hot: Punkt[] = [];
  if (!u.k.orgdata) return { svagheter, hot };

  const ar = u.ar ? ` for ${u.ar}` : "";
  const storlek =
    u.omsattningTkr !== null ? `${belopp(u.omsattningTkr)} in filed revenue${ar}` : null;

  if (u.tillvaxt !== null && u.tillvaxt < 0) {
    svagheter.push({
      text: `Filed revenue is shrinking: ${procent(u.tillvaxt)} a year${
        storlek ? `, down to ${belopp(u.omsattningTkr as number)}${ar}` : ""
      }, from the accounts they filed themselves.`,
      kalla: u.orgKalla,
    });
  }

  if (u.tillvaxt !== null && u.tillvaxt > 0) {
    hot.push({
      text: `They are growing: filed revenue is up ${procent(u.tillvaxt)} a year${
        storlek ? `, to ${belopp(u.omsattningTkr as number)}${ar}` : ""
      }. That is the pace you would have to hold to keep the distance you have.`,
      kalla: u.orgKalla,
    });
  }

  // Largest of those that file. Never "largest of all" — the ones that file
  // nothing here are not in the comparison, and saying otherwise would be the
  // same mistake as counting their absence against them.
  const filare = alla.filter((x) => x.omsattningTkr !== null);
  if (u.omsattningTkr !== null && filare.length >= 2) {
    const sorterade = [...filare].sort(
      (a, b) => (b.omsattningTkr as number) - (a.omsattningTkr as number),
    );
    const toppen = sorterade[0];
    const nasta = sorterade[1];
    if (
      toppen.k === u.k &&
      (toppen.omsattningTkr as number) > (nasta.omsattningTkr as number)
    ) {
      hot.push({
        text: `The biggest company you are up against among those that file here: ${belopp(
          u.omsattningTkr,
        )}${ar}${
          u.anstallda ? ` and ${tal(u.anstallda)} employees` : ""
        }, against ${belopp(nasta.omsattningTkr as number)} for the next largest. Weight of that kind buys attention you have to earn.`,
        kalla: u.orgKalla,
      });
    }
  }

  return { svagheter, hot };
}

/** Where their published price sits in the set — a lever, and a warning. */
function prisplats(u: Underlag, alla: Underlag[]) {
  const mojligheter: Punkt[] = [];
  const hot: Punkt[] = [];
  const medPris = alla.filter((x) => x.pris !== null);

  if (u.pris === null && medPris.length > 0) {
    mojligheter.push({
      text: `They publish no price, while ${medPris.length} of the ${alla.length} competitors read do. A buyer who has to book a call to learn what something costs is a buyer you can take with a price page.`,
      kalla: null,
    });
    return { mojligheter, hot };
  }

  // Two prices make a pair, not a field; three is the fewest that can have ends.
  if (u.pris === null || medPris.length < 3) return { mojligheter, hot };

  const belopper = medPris.map((x) => (x.pris as { belopp: number }).belopp);
  const hogst = Math.max(...belopper);
  const lagst = Math.min(...belopper);
  const ensam = (v: number) => belopper.filter((b) => b === v).length === 1;
  const median = [...belopper].sort((a, b) => a - b)[Math.floor(belopper.length / 2)];

  if (u.pris.belopp === hogst && ensam(hogst)) {
    mojligheter.push({
      text: `The most expensive published price of the ${medPris.length} competitors that publish one: ${tal(
        u.pris.belopp,
      )} SEK a month against a median of ${tal(median)} SEK. Price is a lever against them that costs you nothing to pull.`,
      kalla: u.pris.kalla,
    });
  }

  if (u.pris.belopp === lagst && ensam(lagst)) {
    hot.push({
      text: `They undercut the field: ${tal(
        u.pris.belopp,
      )} SEK a month is the lowest published price of the ${medPris.length} competitors that publish one, against a median of ${tal(
        median,
      )} SEK. That is the number a buyer will hold you to.`,
      kalla: u.pris.kalla,
    });
  }

  return { mojligheter, hot };
}

/* --------------------------------------------------------------------------
   Why a box is empty.

   Stated per quadrant and per cause, because "no deep dive has been run" and
   "the deep dive ran and found nothing" are different facts about a competitor
   and a reader is entitled to know which one they are looking at.
   -------------------------------------------------------------------------- */

function skalStyrkor(u: Underlag) {
  const namn = u.k.namn;
  return u.k.djup
    ? `The deep dive on ${namn} found no point where they are ahead of us, and neither their prices nor the coverage we catalogued set them apart from the others read.`
    : `No deep dive has been run on ${namn}, and that is where the points where a competitor is ahead of us come from. Nothing in their prices or in the coverage we catalogued set them apart from the others read either.`;
}

function skalSvagheter(u: Underlag) {
  const namn = u.k.namn;
  const grund = u.k.djup
    ? `The deep dive on ${namn} found no point where we beat them, and nothing a customer said came through the sources as a complaint.`
    : `No deep dive has been run on ${namn}, so we hold neither the points where we beat them nor what their customers say.`;
  // Reaching here at all means the no-price bullet did not fire, so they publish
  // something; say what the computed checks looked at and did not find.
  const pris =
    (u.k.priser?.length ?? 0) > 0
      ? " They publish a price, and nothing else we could compute counted against them."
      : "";
  // The rule, said out loud where it would otherwise be invisible.
  const register = u.k.orgdata
    ? ""
    : " They file no annual accounts in the Swedish register — which is what a foreign parent, a branch or a sole trader does — and that absence is never counted here as a weakness.";
  return `${grund}${pris}${register}`;
}

function skalMojligheter(u: Underlag) {
  const namn = u.k.namn;
  return u.k.djup
    ? `The deep dive proposed no move against ${namn}, and their published price sits at neither end of this comparison.`
    : `The moves worth making against a competitor come out of the deep dive, and none has been run on ${namn}.`;
}

function skalHot(u: Underlag) {
  const namn = u.k.namn;
  const trend = !u.k.orgdata
    ? `${namn} files no annual accounts in the Swedish register — a foreign parent, a branch or a sole trader files nothing here — so we can state neither their size nor their direction. That is a limit of what we can see, not a finding that they are small or standing still.`
    : u.tillvaxt === null
      ? `${namn} files accounts, but only one readable year, so there is no direction to state.`
      : `${namn}'s filed revenue is not rising, so there is no trend here to warn about.`;
  return `This box holds only what filed accounts and published prices show. ${trend} They are neither the largest of the competitors that file nor the cheapest of those that publish a price.`;
}

/* -------------------------------------------------------------------------- */

/**
 * Same point twice is one point.
 *
 * Identical text is obviously one bullet. The second test is narrower and
 * applies only where the duplication actually showed up: the writer's insight
 * and the reputation angle keep landing on the same review page, and a box that
 * quotes reco.se twice reads as two findings when it is one. So a reputation
 * finding stands down if its page is already cited in that box. It keeps its
 * place in the deep-dive section; it just is not counted twice here. Computed
 * facts are never dropped this way — they are a different kind of claim about
 * the same page.
 */
function ruta(punkter: Punkt[], skal: () => string): SwotRuta {
  const sedda = new Set<string>();
  const kallor = new Set<string>();
  const rena: Punkt[] = [];
  for (const p of punkter) {
    const text = p.text?.trim();
    if (!text) continue;
    const nyckel = text.toLowerCase().replace(/\s+/g, " ");
    if (sedda.has(nyckel)) continue;
    const url = p.kalla?.url;
    if (p.baraOmNyKalla && url && kallor.has(url)) continue;
    sedda.add(nyckel);
    if (url) kallor.add(url);
    rena.push({ text, kalla: p.kalla ?? null });
  }
  return { punkter: rena, tomtSkal: rena.length ? null : skal() };
}

export function byggSwot(konkurrenter: Konkurrent[]): Swot[] {
  const alla = (konkurrenter ?? []).map(underlag);

  return alla.map((u) => {
    const k = u.k;
    const rykte = sorteraRykte(k);
    const fran = siffror(u, alla);
    const pris = prisplats(u, alla);
    const plats = breddPlats(u, alla);

    const styrkor: Punkt[] = [
      ...(k.djup?.battre ?? []).map(franInsikt),
      ...rykte.berom,
    ];
    if (u.pris) {
      const spann = u.spann as { lag: number; hog: number };
      styrkor.push({
        text:
          spann.lag === spann.hog
            ? `They publish a price — ${tal(spann.lag)} SEK a month — so a buyer can compare them without asking anyone.`
            : `They publish a price: ${
                (k.priser ?? []).length
              } points listed, from ${tal(spann.lag)} to ${tal(
                spann.hog,
              )} SEK a month, so a buyer can compare them without asking anyone.`,
        kalla: u.pris.kalla,
      });
    } else if ((k.priser ?? []).length > 0) {
      styrkor.push({
        text: `They publish prices on their own pages — ${
          k.priser.length
        } listed, though none in a form we could reduce to a monthly figure — so a buyer can compare them without asking anyone.`,
        kalla: k.priser[0].kalla,
      });
    }
    if (plats === "bredast") {
      styrkor.push({
        text: `The widest coverage of the competitors read: ${tal(
          u.bredd,
        )} capabilities catalogued from their own pages, at least two more than anyone else here.`,
        kalla: null,
      });
    }

    const svagheter: Punkt[] = [
      ...(k.djup?.samre ?? []).map(franInsikt),
      ...rykte.klagomal,
      ...fran.svagheter,
    ];
    if ((k.priser ?? []).length === 0) {
      svagheter.push({
        text: `No price on any page we read. A buyer has to ask, and asking is a step at which buyers leave.`,
        kalla: null,
      });
    }
    if (plats === "smalast") {
      svagheter.push({
        text: `The narrowest coverage of the competitors read: ${tal(
          u.bredd,
        )} capabilities catalogued from their own pages, at least two fewer than anyone else here.`,
        kalla: null,
      });
    }

    const mojligheter: Punkt[] = [
      ...(k.djup?.taktik ?? []).map((t) => ({ text: t, kalla: null })),
      ...pris.mojligheter,
    ];

    const hot: Punkt[] = [...fran.hot, ...pris.hot];

    return {
      konkurrent: k.namn,
      styrkor: ruta(styrkor, () => skalStyrkor(u)),
      svagheter: ruta(svagheter, () => skalSvagheter(u)),
      mojligheter: ruta(mojligheter, () => skalMojligheter(u)),
      hot: ruta(hot, () => skalHot(u)),
    };
  });
}
