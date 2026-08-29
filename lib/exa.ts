/**
 * Exa. Neural search, which on Swedish queries returns the actual product
 * sites where a SERP returns "Bästa bokföringsprogram 2026" listicles.
 *
 * It can also return page text with the results, so a register lookup that
 * cost a search plus a scrape on Firecrawl costs one call here.
 */
const BAS = "https://api.exa.ai";
const TIMEOUT = Number(process.env.EXA_TIMEOUT_MS ?? 30_000);

export type ExaTraff = {
  url: string;
  title?: string;
  text?: string;
  publishedDate?: string;
};

export function harExa(): boolean {
  return Boolean(process.env.EXA_API_KEY);
}

export async function exaSok(
  fraga: string,
  val: {
    antal?: number;
    domaner?: string[];
    text?: number;
    typ?: "auto" | "neural" | "keyword";
  } = {},
): Promise<ExaTraff[]> {
  const nyckel = process.env.EXA_API_KEY;
  if (!nyckel) throw new Error("EXA_API_KEY saknas i miljön.");

  const r = await fetch(`${BAS}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": nyckel },
    body: JSON.stringify({
      query: fraga,
      numResults: val.antal ?? 6,
      type: val.typ ?? "auto",
      ...(val.domaner?.length ? { includeDomains: val.domaner } : {}),
      ...(val.text ? { contents: { text: { maxCharacters: val.text } } } : {}),
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });

  if (!r.ok) throw new Error(`Exa svarade ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = (await r.json()) as { results?: ExaTraff[] };
  return d.results ?? [];
}
