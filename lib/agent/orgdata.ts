import { exaSok, harExa } from "../exa";
import { skrapa, sok } from "../firecrawl";
import type { Bokslutsar, Orgdata } from "../types";
import { skrapa as skrapaSida } from "../firecrawl";

const REGISTER = ["allabolag.se", "bolagsfakta.se", "ratsit.se", "proff.se"];
const REGISTER_RE = /allabolag\.se|bolagsfakta\.se|ratsit\.se|proff\.se/;

/** "1 796 000", with the non-breaking spaces the registers render it with. */
function tal(rå: string | undefined): number | null {
  if (!rå) return null;
  const n = Number(rå.replace(/[\s  ]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Strip the legal-form suffixes and punctuation that differ between a brand
 *  name and a registered one: "Kontiq" vs "Kontiq Sverige AB". */
function nyckelnamn(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(ab|hb|kb|aktiebolag|publ|group|sverige|sweden|nordic)\b/g, "")
    .replace(/[^a-z0-9åäö]/g, "")
    .trim();
}

/**
 * The registers are full of similarly named companies, and a search for a small
 * startup will happily return a large unrelated one. Attributing a stranger's
 * revenue to a competitor is worse than having no figure at all, so the page
 * must actually be about the company we asked for.
 */
function ombolaget(md: string, namn: string): boolean {
  const sokt = nyckelnamn(namn);
  if (sokt.length < 3) return false;

  const rubrik = md.match(/^#\s+(.+)$/m)?.[1] ?? "";
  const juridiskt = md.match(/Juridiskt namn\s*([^\n]{2,60})/)?.[1] ?? "";
  const kandidater = [rubrik, juridiskt].map(nyckelnamn).filter(Boolean);
  if (!kandidater.length) return false;

  return kandidater.some((k) => k.includes(sokt) || sokt.includes(k));
}

/**
 * Five filed years, from the register's own accounts table:
 *
 *   | BOKSLUTSPERIOD | 2024-12 | 2023-12 | 2022-12 | ...
 *   Omsättning | 1 796 000 | 1 438 000 | 1 098 000 | ...
 *
 * One year is a number; five is a trend, and a trend is the thing a competitor
 * cannot hide behind a marketing page.
 */
export async function hamtaHistorik(orgnr: string): Promise<Bokslutsar[]> {
  const rent = orgnr.replace(/\D/g, "");
  if (rent.length !== 10) return [];

  const sida = await skrapaSida(`https://www.allabolag.se/${rent}/bokslut`);
  if (!sida) return [];

  const md = sida.markdown;
  const ar = md
    .match(/BOKSLUTSPERIOD([^\n]*)/)?.[1]
    ?.match(/(20\d\d)-\d\d/g)
    ?.map((x) => Number(x.slice(0, 4)));
  if (!ar?.length) return [];

  const rad = (etikett: string): (number | null)[] => {
    const träff = md.match(new RegExp(`${etikett}\\s*\\|([^\n]*)`));
    if (!träff) return [];
    return träff[1]
      .split("|")
      .slice(0, ar.length)
      .map((c) => {
        const n = Number(c.replace(/[\s  ]/g, "").replace(",", "."));
        return Number.isFinite(n) && c.trim() ? n : null;
      });
  };

  const oms = rad("Omsättning");
  const res = rad("Resultat efter finansnetto");

  return ar
    .map((a, i) => ({
      ar: a,
      omsattningTkr: oms[i] ?? null,
      resultatTkr: res[i] ?? null,
    }))
    .filter((r) => r.omsattningTkr !== null || r.resultatTkr !== null);
}

/** Swedish organisationsnummer carry a Luhn check digit over all ten digits. */
function luhnOk(siffror: string): boolean {
  let summa = 0;
  for (let i = 0; i < siffror.length; i++) {
    let d = Number(siffror[i]);
    if (i % 2 === 0) d *= 2;
    if (d > 9) d -= 9;
    summa += d;
  }
  return summa % 10 === 0;
}

/**
 * Ten digits, Luhn-clean, and a third digit of 2 or more.
 *
 * The third digit is the group code (5 = aktiebolag, 7 = ekonomisk förening,
 * 9 = handelsbolag …) and is never 0 or 1 for an organisation — those shapes
 * are personnummer. An enskild firma trades under its owner's personnummer,
 * files no annual accounts at all, and putting a private person's number in a
 * competitor report is not something we are willing to do. So a number in that
 * shape is deliberately rejected: there is nothing to fetch behind it.
 *
 * Validating here rather than at the register turns a bad number into zero
 * network calls instead of a wasted scrape.
 */
export function giltigtOrgnr(rå: string | null | undefined): string | null {
  if (!rå) return null;
  const rent = rå.replace(/\D/g, "");
  if (rent.length !== 10) return null;
  if (Number(rent[2]) < 2) return null;
  return luhnOk(rent) ? rent : null;
}

/** "5564696291" -> "556469-6291", the way every register prints it. */
export function formateraOrgnr(rent: string): string {
  return `${rent.slice(0, 6)}-${rent.slice(6)}`;
}

/**
 * The org number off the competitor's OWN page.
 *
 * Swedish companies are required to publish it, so it is almost always in the
 * footer or on an "om oss", "kontakt" or terms page — and unlike a brand name
 * it is exact. Three shapes, most explicit first:
 *
 *   1. a VAT number, SE + the ten digits + 01 ("SE556469629101"),
 *   2. digits introduced by Org.nr / Organisationsnummer / momsreg…,
 *   3. the hyphenated 556469-6291 form on its own.
 *
 * A bare run of ten digits is NOT accepted: phone numbers, article ids and
 * timestamps all look like that, and a wrong number here would send us to a
 * stranger's accounts.
 */
export function plockaOrgnr(text: string): { orgnr: string; citat: string } | null {
  if (!text) return null;
  // Non-breaking spaces and soft hyphens are all over Swedish footers.
  const t = text.replace(/[\u00a0\u2007\u202f]/g, " ").replace(/[\u00ad]/g, "");

  const monster: RegExp[] = [
    // The org number is embedded in the Swedish VAT number, between SE and 01.
    /\bSE\s?(\d{6})\s?-?\s?(\d{4})\s?01\b/gi,
    /\b(?:org(?:anisations)?\s*\.?\s*(?:nr|nummer)|momsreg\w*|vat[\s.]*(?:nr|no|number)?)\s*[:.\-–]?\s*(?:SE)?\s*(\d{6})\s?-?\s?(\d{4})/gi,
    /(?<![\d-])(\d{6})-(\d{4})(?![\d-])/g,
  ];

  for (const re of monster) {
    const funna = new Map<string, { antal: number; sist: number; citat: string }>();

    for (const m of t.matchAll(re)) {
      const orgnr = giltigtOrgnr(`${m[1]}${m[2]}`);
      if (!orgnr) continue;
      const i = m.index ?? 0;
      const citat = t
        .slice(Math.max(0, i - 60), i + m[0].length + 20)
        .replace(/\s+/g, " ")
        .trim();
      const fanns = funna.get(orgnr);
      funna.set(orgnr, { antal: (fanns?.antal ?? 0) + 1, sist: i, citat });
    }
    if (!funna.size) continue;

    // A site can name several companies — Qvitta's product demo lists example
    // firms in a dropdown. The company's own number is the one repeated on every
    // page, and when the count ties, the later one: footers sit at the bottom.
    const [orgnr, vald] = [...funna].sort(
      (a, b) => b[1].antal - a[1].antal || b[1].sist - a[1].sist,
    )[0];
    return { orgnr, citat: vald.citat };
  }
  return null;
}

/**
 * `kravNamn` is false on the org-number path. There the number itself is the
 * verification — we asked allabolag for exactly one company — and the register
 * answers under the registered name, which is routinely not the brand name:
 * Qvitta files as "H&S Systembydesign AB", Accounted as "Arcim Technology AB",
 * Fortnox as "Fortnox Aktiebolag". Keeping the name guard on that path would
 * throw away correct matches for the very reason the org number was needed.
 */
function plocka(md: string, url: string, namn: string, kravNamn = true): Orgdata | null {
  if (kravNamn && !ombolaget(md, namn)) {
    console.warn(`[orgdata] ${namn}: ${url} is about a different company — dropped`);
    return null;
  }

  const oms = md.match(/Omsättning\s*(\d{4})?\s*(-?[\d\s  ]{3,})/);
  const res = md.match(/Resultat efter finansnetto\s*(\d{4})?\s*(-?[\d\s  ]{3,})/);
  const anst = md.match(/Antal anställda\s*(\d[\d\s  ]*)/);
  const org = md.match(/(?:Org\.?nr|Organisationsnummer)\s*(\d{6}-?\d{4})/);

  const omsattningTkr = tal(oms?.[2]);
  const anstallda = tal(anst?.[1]);
  if (omsattningTkr === null && anstallda === null) return null;

  const rad = (oms ?? anst)?.[0]?.replace(/[  ]/g, " ").trim() ?? null;

  return {
    orgnr: org?.[1] ?? null,
    omsattningTkr,
    resultatTkr: tal(res?.[2]),
    anstallda,
    // The registers chart history in JavaScript, so year-on-year growth is not
    // in the text. Better absent than guessed.
    tillvaxtProcent: null,
    ar: oms?.[1] ? Number(oms[1]) : null,
    historik: [],
    kalla: rad ? { url, citat: rad } : null,
  };
}

/** Five filed years give a real growth rate; a single year gives none. */
async function komplettera(ut: Orgdata): Promise<Orgdata> {
  if (!ut.orgnr) return ut;
  ut.historik = await hamtaHistorik(ut.orgnr).catch(() => []);
  const [nu, forra] = ut.historik;
  if (nu?.omsattningTkr && forra?.omsattningTkr) {
    ut.tillvaxtProcent = Math.round(
      ((nu.omsattningTkr - forra.omsattningTkr) / forra.omsattningTkr) * 100,
    );
  }
  return ut;
}

/**
 * The direct route: allabolag redirects /<ten digits> straight to that one
 * company's page, so a number we read off the competitor's own site skips the
 * search entirely. No ranking, no similarly named strangers, one scrape.
 *
 * Verified live against allabolag.se before this was written — /5564696291
 * lands on Fortnox Aktiebolag with the same markup plocka() already parses.
 */
async function hamtaViaOrgnr(orgnr: string, namn: string): Promise<Orgdata | null> {
  const sida = await skrapa(`https://www.allabolag.se/${orgnr}`);
  if (!sida) return null;

  // The number replaces the name guard, so it has to be checked just as hard:
  // the page we got back must itself carry the number we asked for. A redirect
  // to a search page or a masked profile fails this and yields null.
  const pa = sida.markdown.match(/(?:Org\.?nr|Organisationsnummer)\s*(\d{6})-?(\d{4})/);
  if (!pa || `${pa[1]}${pa[2]}` !== orgnr) {
    console.warn(`[orgdata] ${namn}: ${orgnr} — the register page does not carry that number, dropped`);
    return null;
  }

  const ut = plocka(sida.markdown, sida.url, namn, false);
  if (!ut) return null;
  ut.orgnr = formateraOrgnr(orgnr);
  return komplettera(ut);
}

/**
 * The moat. Every Swedish AB files public annual accounts, so we can state a
 * competitor's revenue and headcount — which no marketing page reveals and no
 * tool built for the US market goes looking for.
 *
 * Parsed, not prompted: the registers render these figures in a fixed shape,
 * and a regex cannot invent a number that is not on the page.
 *
 * `orgnr` is the number found on the competitor's own site. When we have one it
 * is tried first, because searching the registers for a brand name is the step
 * that both misses ("Redofy" finds nothing) and mismatches ("Qvitta" finds
 * Qvittra AB). The name search stays as the fallback for sites that publish no
 * number.
 */
export async function hamtaOrgdata(namn: string, orgnr?: string | null): Promise<Orgdata | null> {
  const rent = giltigtOrgnr(orgnr);
  if (orgnr && !rent) {
    console.warn(`[orgdata] ${namn}: "${orgnr}" is not a valid org number — falling back to the name`);
  }
  if (rent) {
    try {
      const ut = await hamtaViaOrgnr(rent, namn);
      if (ut) return ut;
    } catch (e) {
      console.error(`[orgdata] orgnr ${namn}:`, e instanceof Error ? e.message : e);
    }
  }

  // Exa can search inside the registers and hand back the page text in one
  // call, which keeps the whole lookup off the Firecrawl rate limit.
  if (harExa()) {
    try {
      const traffar = await exaSok(`${namn} omsättning anställda bokslut`, {
        antal: 3,
        domaner: REGISTER,
        text: 3_000,
      });
      for (const t of traffar) {
        const ut = t.text ? plocka(t.text, t.url, namn) : null;
        if (!ut) continue;
        return komplettera(ut);
      }
    } catch (e) {
      console.error(`[orgdata] exa ${namn}:`, e instanceof Error ? e.message : e);
    }
  }

  try {
    const traffar = await sok(`${namn} allabolag omsättning anställda`, { limit: 5 });
    const kandidat = traffar.find((t) => REGISTER_RE.test(t.url));
    if (!kandidat) return null;
    const sida = await skrapa(kandidat.url);
    const ut = sida ? plocka(sida.markdown, sida.url, namn) : null;
    // Same completion as the Exa path: one page is a number, five years is the trend.
    return ut ? komplettera(ut) : null;
  } catch (e) {
    console.error(`[orgdata] ${namn}:`, e instanceof Error ? e.message : e);
    return null;
  }
}
