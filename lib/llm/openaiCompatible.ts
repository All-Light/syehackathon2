/**
 * Any OpenAI-shaped /chat/completions endpoint. This is the swap-in path for a
 * DeepSeek, OpenRouter or other key — set GRADER_PROVIDER=openai-compatible and
 * the three env vars below. No other code changes.
 */
export async function kor(prompt: string): Promise<string> {
  const bas = process.env.GRADER_BASE_URL;
  const nyckel = process.env.GRADER_API_KEY;
  const modell = process.env.GRADER_MODEL;
  if (!bas || !nyckel || !modell) {
    throw new Error(
      "GRADER_BASE_URL, GRADER_API_KEY och GRADER_MODEL måste vara satta för openai-compatible.",
    );
  }

  const r = await fetch(`${bas.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${nyckel}`,
    },
    body: JSON.stringify({
      model: modell,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(Number(process.env.GRADER_TIMEOUT_MS ?? 60_000)),
  });

  if (!r.ok) throw new Error(`Grader svarade ${r.status}: ${await r.text()}`);
  const d = await r.json();
  const text = d?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("Oväntat svarsformat från grader.");
  return text;
}
