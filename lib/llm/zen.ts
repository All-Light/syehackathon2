/**
 * opencode Zen (opencode-go) — an OpenAI-compatible endpoint keyed by OPENCODE_API_KEY.
 *
 * This is the default because it needs no binary, so it runs on Vercel where the
 * opencode CLI cannot. The CLI routes to this same backend anyway, so it buys
 * no latency — the model choice does.
 *
 * qwen3.8-flash measured 14.9-19.2s on our extraction prompt against
 * deepseek-v4-flash's 22.0-28.9s, glm-5.3-flash's 57s and qwen3.8-max timing
 * out past 200s. The tight spread matters more than the mean: a run makes six
 * of these calls and the slowest one sets the wall clock.
 *
 * `reasoning_effort: "minimal"` still matters — these are reasoning models and
 * will otherwise spend thousands of tokens thinking before answering.
 */
const BAS = process.env.GRADER_BASE_URL ?? "https://opencode.ai/zen/go/v1";
const MODELL = process.env.LLM_MODEL ?? process.env.GRADER_MODEL ?? "qwen3.8-flash";
const TIMEOUT = Number(process.env.GRADER_TIMEOUT_MS ?? 120_000);

export async function kor(prompt: string, timeoutMs?: number): Promise<string> {
  const nyckel = process.env.OPENCODE_API_KEY ?? process.env.GRADER_API_KEY;
  if (!nyckel) throw new Error("OPENCODE_API_KEY is missing from the environment.");

  const r = await fetch(`${BAS.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${nyckel}`,
    },
    body: JSON.stringify({
      model: MODELL,
      temperature: 0.2,
      reasoning_effort: "minimal",
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(timeoutMs ?? TIMEOUT),
  });

  if (!r.ok) throw new Error(`Zen responded ${r.status}: ${await r.text()}`);
  const d = await r.json();
  const text = d?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("Unexpected response format from Zen.");
  return text;
}
