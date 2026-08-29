import type { z } from "zod";
import { plockaJson } from "./json";

/**
 * Provider-agnostic. Carried over from Lugn: "zen" (OpenCode Zen) by default,
 * any OpenAI-shaped endpoint via LLM_PROVIDER=openai-compatible.
 */
async function transport(): Promise<(prompt: string, timeoutMs?: number) => Promise<string>> {
  const provider = process.env.LLM_PROVIDER ?? process.env.GRADER_PROVIDER ?? "zen";
  const { kor } =
    provider === "openai-compatible"
      ? await import("./openaiCompatible")
      : await import("./zen");
  return kor;
}

/**
 * One structured call. Small fast models fence their JSON and occasionally
 * miss a field, so we validate and retry rather than trusting the first answer.
 */
export async function struktur<T>(
  prompt: string,
  schema: z.ZodType<T>,
  val: { forsok?: number; timeoutMs?: number } = {},
): Promise<T> {
  const kor = await transport();
  const forsok = val.forsok ?? 2;
  let sistaFel: unknown;
  for (let n = 0; n < forsok; n++) {
    try {
      return schema.parse(plockaJson(await kor(prompt, val.timeoutMs)));
    } catch (e) {
      sistaFel = e;
    }
  }
  throw sistaFel instanceof Error ? sistaFel : new Error("LLM-anropet misslyckades.");
}

export { plockaJson };
