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

function plocka(md: string, url: string, namn: string): Orgdata | null {
  if (!ombolaget(md, namn)) {
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

/**
 * The moat. Every Swedish AB files public annual accounts, so we can state a
 * competitor's revenue and headcount — which no marketing page reveals and no
 * tool built for the US market goes looking for.
 *
 * Parsed, not prompted: the registers render these figures in a fixed shape,
 * and a regex cannot invent a number that is not on the page.
 */
export async function hamtaOrgdata(namn: string): Promise<Orgdata | null> {
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
        if (ut.orgnr) {
          ut.historik = await hamtaHistorik(ut.orgnr).catch(() => []);
          // Five filed years give a real growth rate; a single year gives none.
          const [nu, forra] = ut.historik;
          if (nu?.omsattningTkr && forra?.omsattningTkr) {
            ut.tillvaxtProcent = Math.round(
              ((nu.omsattningTkr - forra.omsattningTkr) / forra.omsattningTkr) * 100,
            );
          }
        }
        return ut;
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
    return sida ? plocka(sida.markdown, sida.url, namn) : null;
  } catch (e) {
    console.error(`[orgdata] ${namn}:`, e instanceof Error ? e.message : e);
    return null;
  }
}
