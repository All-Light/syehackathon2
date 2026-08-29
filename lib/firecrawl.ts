/**
 * Firecrawl v2 over plain HTTP. Not the CLI — Vercel cannot shell out.
 * Verified live against api.firecrawl.dev before this was written.
 */
const BAS = process.env.FIRECRAWL_BASE_URL ?? "https://api.firecrawl.dev/v2";
const TIMEOUT = Number(process.env.FIRECRAWL_TIMEOUT_MS ?? 45_000);

export type SokTraff = {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
};

export type Lank = { url: string; title?: string; description?: string };

async function anrop<T>(vag: string, kropp: unknown): Promise<T> {
  const nyckel = process.env.FIRECRAWL_API_KEY;
  if (!nyckel) throw new Error("FIRECRAWL_API_KEY saknas i miljön.");

  const r = await fetch(`${BAS}${vag}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${nyckel}`,
    },
    body: JSON.stringify(kropp),
    signal: AbortSignal.timeout(TIMEOUT),
  });

  if (!r.ok) {
    throw new Error(`Firecrawl ${vag} svarade ${r.status}: ${await r.text()}`);
  }
  return (await r.json()) as T;
}

/** Web search. `location` steers the result set to Swedish sources. */
export async function sok(
  fraga: string,
  val: { limit?: number; land?: string; medInnehall?: boolean } = {},
): Promise<SokTraff[]> {
  const svar = await anrop<{ data?: { web?: SokTraff[] } }>("/search", {
    query: fraga,
    limit: val.limit ?? 5,
    sources: ["web"],
    location: val.land ?? "Sweden",
    ...(val.medInnehall
      ? { scrapeOptions: { formats: ["markdown"], onlyMainContent: true } }
      : {}),
  });
  return svar.data?.web ?? [];
}

/** Site map, optionally filtered — this is how the agent finds a pricing page. */
export async function karta(
  url: string,
  val: { search?: string; limit?: number } = {},
): Promise<Lank[]> {
  const svar = await anrop<{ links?: Lank[] }>("/map", {
    url,
    ...(val.search ? { search: val.search } : {}),
    limit: val.limit ?? 30,
  });
  return svar.links ?? [];
}

export type Sida = { url: string; markdown: string; titel: string };

export async function skrapa(url: string): Promise<Sida | null> {
  try {
    const svar = await anrop<{
      data?: { markdown?: string; metadata?: { title?: string; sourceURL?: string } };
    }>("/scrape", {
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      maxAge: 86_400_000,
    });
    const markdown = svar.data?.markdown;
    if (!markdown) return null;
    return {
      url: svar.data?.metadata?.sourceURL ?? url,
      markdown,
      titel: svar.data?.metadata?.title ?? url,
    };
  } catch {
    // One dead page must not kill a five-competitor run.
    return null;
  }
}

/** Bounded parallelism. Firecrawl rate-limits, and so does the grader. */
export async function parallellt<T, R>(
  poster: T[],
  tak: number,
  arbete: (post: T, index: number) => Promise<R>,
): Promise<R[]> {
  const ut: R[] = new Array(poster.length);
  let nasta = 0;
  const arbetare = Array.from({ length: Math.min(tak, poster.length) }, async () => {
    for (;;) {
      const i = nasta++;
      if (i >= poster.length) return;
      ut[i] = await arbete(poster[i], i);
    }
  });
  await Promise.all(arbetare);
  return ut;
}
