import type { z } from "zod";
import { harClaude } from "./claude";
import { plockaJson } from "./json";

/**
 * Two tiers, because the two jobs are not alike.
 *
 * "snabb" — extraction and ranking. A run makes six or more of these, their
 * output is a schema rather than prose, and the fast model is measurably
 * quicker at them.
 *
 * "skrivande" — the report's judgment and the deep-dive dossier: the parts a
 * customer actually reads. Claude when a key is configured, and the fast model
 * when it is not, so the product still works without one.
 */
export type Niva = "snabb" | "skrivande";

async function transport(
  niva: Niva,
): Promise<(prompt: string, timeoutMs?: number) => Promise<string>> {
  if (niva === "skrivande" && harClaude()) {
    return (await import("./claude")).kor;
  }
  const provider = process.env.LLM_PROVIDER ?? process.env.GRADER_PROVIDER ?? "zen";
  const { kor } =
    provider === "openai-compatible"
      ? await import("./openaiCompatible")
      : await import("./zen");
  return kor;
}

/** What actually wrote a given piece, so the report can say so. */
export async function skrivandeModell(): Promise<string> {
  if (harClaude()) return (await import("./claude")).MODELL;
  return process.env.LLM_MODEL ?? process.env.GRADER_MODEL ?? "qwen3.8-flash";
}

/**
 * One structured call. Small fast models fence their JSON and occasionally
 * miss a field, so we validate and retry rather than trusting the first answer.
 */
export async function struktur<T>(
  prompt: string,
  schema: z.ZodType<T>,
  val: { forsok?: number; timeoutMs?: number; niva?: Niva } = {},
): Promise<T> {
  const niva = val.niva ?? "snabb";
  const kor = await transport(niva);
  // Characters in, characters out — the only per-call cost signal we have
  // without a token counter, and enough to size a report's bill.
  console.log(`[llm] ${niva} prompt ${prompt.length} chars`);
  const forsok = val.forsok ?? 2;
  let sistaFel: unknown;
  for (let n = 0; n < forsok; n++) {
    try {
      const rå = await kor(prompt, val.timeoutMs);
      console.log(`[llm] ${niva} svar ${rå.length} chars`);
      return schema.parse(plockaJson(rå));
    } catch (e) {
      sistaFel = e;
    }
  }
  throw sistaFel instanceof Error ? sistaFel : new Error("The LLM call failed.");
}

export { plockaJson };
