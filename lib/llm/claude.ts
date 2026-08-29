import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude writes the parts a reader actually reads: the report's judgment and
 * the deep-dive dossier. Extraction stays on the cheap fast model — there are
 * five or more of those calls per run and their output is a schema, not prose.
 *
 * Adaptive thinking is on because these are judgment calls, not transcription.
 */
export const MODELL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

let klient: Anthropic | null = null;

export function harClaude(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function hamtaKlient(): Anthropic {
  // The SDK resolves ANTHROPIC_API_KEY itself; constructing it once keeps the
  // connection pool warm across the several calls a deep dive makes.
  if (!klient) klient = new Anthropic();
  return klient;
}

export async function kor(prompt: string, timeoutMs?: number): Promise<string> {
  if (!harClaude()) throw new Error("ANTHROPIC_API_KEY is missing from the environment.");

  const svar = await hamtaKlient().messages.create(
    {
      model: MODELL,
      max_tokens: 16_000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      messages: [{ role: "user", content: prompt }],
    },
    { timeout: timeoutMs ?? Number(process.env.ANTHROPIC_TIMEOUT_MS ?? 180_000) },
  );

  if (svar.stop_reason === "refusal") {
    throw new Error(
      `Claude declined: ${svar.stop_details?.explanation ?? "no explanation given"}`,
    );
  }

  const text = svar.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) throw new Error("Empty response from Claude.");
  return text;
}
