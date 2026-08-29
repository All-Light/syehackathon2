import type { Foretag } from "../types";

/**
 * The interface is English. The advice is not necessarily: a Stockholm shop
 * owner reading three actions about their own pricing wants them in Swedish,
 * and that is the wedge we sell on. So the prompts are English — models follow
 * them better — and the output language follows the site we analysed.
 *
 * Set REPORT_LANGUAGE=en or sv to force it.
 */
export function arSvensk(egen: { sprak: string; geografi: string }): boolean {
  const tvingad = process.env.REPORT_LANGUAGE;
  if (tvingad === "sv") return true;
  if (tvingad === "en") return false;
  return /svensk|swedish/i.test(egen.sprak) || /sverige|sweden/i.test(egen.geografi);
}

export function sprakInstruktion(svensk: boolean): string {
  return svensk
    ? "Write every piece of prose you output in Swedish, the way a Swedish adviser would speak."
    : "Write every piece of prose you output in English.";
}

export function sprakFor(egen: Foretag): string {
  return sprakInstruktion(arSvensk(egen));
}
