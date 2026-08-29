/**
 * opencode Zen (opencode-go) — an OpenAI-compatible endpoint keyed by OPENCODE_API_KEY.
 *
 * This is the default because it needs no binary, so it runs on Vercel where the
 * opencode CLI cannot. `reasoning_effort: "minimal"` matters a great deal here:
 * deepseek-v4-flash is a reasoning model and will otherwise spend ~9k tokens
 * thinking (measured 92s vs 43s).
 */
const BAS = process.env.GRADER_BASE_URL ?? "https://opencode.ai/zen/go/v1";
const MODELL = process.env.GRADER_MODEL ?? "deepseek-v4-flash";
const TIMEOUT = Number(process.env.GRADER_TIMEOUT_MS ?? 120_000);

export async function kor(prompt: string): Promise<string> {
  const nyckel = process.env.OPENCODE_API_KEY ?? process.env.GRADER_API_KEY;
  if (!nyckel) throw new Error("OPENCODE_API_KEY saknas i miljön.");

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
    signal: AbortSignal.timeout(TIMEOUT),
  });

  if (!r.ok) throw new Error(`Zen svarade ${r.status}: ${await r.text()}`);
  const d = await r.json();
  const text = d?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("Oväntat svarsformat från Zen.");
  return text;
}
