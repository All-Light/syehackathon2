import { z } from "zod";
import { skrapa } from "../firecrawl";
import { struktur } from "../llm";
import type { Foretag } from "../types";

const Schema = z.object({
  namn: z.string(),
  vadNiSaljer: z.string(),
  malgrupp: z.string(),
  prismodell: z.string(),
  sprak: z.string(),
  geografi: z.string(),
  nyckelord: z.array(z.string()).min(2),
});

/** Step 01. Everything downstream is steered by this, so it reads the real site. */
export async function profileraSjalv(url: string): Promise<Foretag> {
  // This one fetch is the single point of failure for the whole run: everything
  // downstream is steered by it. Firecrawl's per-minute cap is shared across
  // every concurrent run on the account, so a burst can lose this page while
  // the address is perfectly fine — worth waiting out rather than failing.
  let sida = await skrapa(url);
  for (let forsok = 1; !sida && forsok <= 2; forsok++) {
    await new Promise((k) => setTimeout(k, forsok * 8_000));
    sida = await skrapa(url, { farsk: true });
  }

  if (!sida) {
    // Do not tell someone to check an address we never rejected. It parsed, we
    // simply could not fetch it.
    throw new Error(
      `Could not fetch ${url}. The site may be blocking us, or we may be over our own rate limit — worth trying again in a minute.`,
    );
  }

  const p = `You are reading a company's own website and summarising what they do.

# The page
URL: ${sida.url}
Title: ${sida.titel}

${sida.markdown.slice(0, 12_000)}

# Task
Fill in the fields from what the page ACTUALLY says. Do not guess.
- "namn": the company name.
- "vadNiSaljer": one sentence on what they sell.
- "malgrupp": who buys it. Be concrete ("small business owners in Sweden", not "customers").
- "prismodell": subscription, per-unit, quote-only — and the price level if it is shown.
  Write "framgår ej" if no price is published.
- "sprak": the language the site is written in, e.g. "svenska" or "engelska".
- "geografi": the market they appear to target.
- "nyckelord": 2-6 search terms you would use to find their COMPETITORS.
  Use the same language as the site. Terms, not sentences.

Write these field values in the site's own language.

Answer with ONLY valid JSON, no prose, no markdown fence:
{"namn":"","vadNiSaljer":"","malgrupp":"","prismodell":"","sprak":"","geografi":"","nyckelord":[]}`;

  const ut = await struktur(p, Schema, { timeoutMs: 60_000 });
  return { ...ut, nyckelord: ut.nyckelord.slice(0, 6), url: sida.url };
}
