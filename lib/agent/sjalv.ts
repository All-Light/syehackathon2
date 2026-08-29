import type { Foretag, Konkurrent } from "../types";
import { arSvensk } from "./sprak";
import { undersokKonkurrent } from "./undersok";

/**
 * Step 01b. The customer's own company, read exactly the way a competitor is.
 *
 * The whole point is the reuse: same page selection, same scrape, same
 * priced-claim extraction behind the same citation guard, same register
 * lookup. A comparison whose two sides were measured with different
 * instruments is not a comparison — "you are more expensive than them" only
 * means something when both figures were produced the same way.
 *
 * Returns null rather than throwing. This is an enhancement to the report, and
 * an enhancement must never become a new way for the analysis to fail.
 */
export async function undersokEgen(
  egen: Foretag,
  loggning?: (text: string) => void,
): Promise<Konkurrent | null> {
  try {
    // profileraSjalv has already scraped the start page, so this map-and-scrape
    // hits Firecrawl's 24h cache for the homepage and pays full price only for
    // the pages the profile never looked at — the pricing page above all.
    const ut = await undersokKonkurrent(
      {
        namn: egen.namn,
        url: egen.url,
        // "varfor" is the reason a company is in the set. For us it is not a
        // finding, it is the premise.
        varfor: "This is you — read the same way as the competitors.",
      },
      // Neither "du" nor "agenten" is true of the customer's own company: the
      // field asks who found this competitor, and we found no one. "du" is the
      // least-wrong — the URL came from the user — and inventing a third value
      // would break every consumer of the shared type.
      "du",
      arSvensk(egen),
      loggning,
    );

    // undersokKonkurrent never throws on a dead site — it hands back a shell
    // saying "Could not be read.". For a competitor that is a finding; for us it
    // is an empty anchor on the positioning map and a row in the report that
    // states nothing. No pages read means no own profile.
    return ut.sidor.length ? ut : null;
  } catch (fel) {
    console.error("[sjalv]", fel instanceof Error ? fel.message : fel);
    return null;
  }
}
