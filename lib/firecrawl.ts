/**
 * Firecrawl v2 over plain HTTP. Not the CLI — Vercel cannot shell out.
 * Verified live against api.firecrawl.dev before this was written.
 */
const BAS = process.env.FIRECRAWL_BASE_URL ?? "https://api.firecrawl.dev/v2";
const TIMEOUT = Number(process.env.FIRECRAWL_TIMEOUT_MS ?? 45_000);
/** The plan allows ~18 requests a minute. Staying under is cheaper than a 429
 *  that costs a 45-second retry-after in the middle of a demo. */
const TAK_PER_MIN = Number(process.env.FIRECRAWL_RPM ?? 15);

let fonster: number[] = [];

/** Rolling-window gate shared by every call in the process. */
async function slussa(): Promise<void> {
  for (;;) {
    const nu = Date.now();
    fonster = fonster.filter((t) => nu - t < 60_000);
    if (fonster.length < TAK_PER_MIN) {
      fonster.push(nu);
      return;
    }
    await new Promise((k) => setTimeout(k, 60_000 - (nu - fonster[0]) + 60));
  }
}

export type SokTraff = {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
};

export type Lank = { url: string; title?: string; description?: string };

/**
 * Five competitors researched at once means bursts of parallel calls, and a
 * swallowed 429 looks exactly like "this company has no public accounts".
 * Back off and retry instead of losing the data.
 */
async function anrop<T>(vag: string, kropp: unknown): Promise<T> {
  const nyckel = process.env.FIRECRAWL_API_KEY;
  if (!nyckel) throw new Error("FIRECRAWL_API_KEY is missing from the environment.");

  let sistaFel = "";
  for (let forsok = 0; forsok < 3; forsok++) {
    await slussa();
    const r = await fetch(`${BAS}${vag}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${nyckel}`,
      },
      body: JSON.stringify(kropp),
      signal: AbortSignal.timeout(TIMEOUT),
    });

    if (r.ok) return (await r.json()) as T;

    sistaFel = `Firecrawl ${vag} responded ${r.status}: ${(await r.text()).slice(0, 200)}`;
    if (r.status !== 429 && r.status < 500) break;

    const efter = Number(r.headers.get("retry-after"));
    const vanta = Number.isFinite(efter) && efter > 0 ? efter * 1000 : 1500 * 2 ** forsok;
    console.warn(`[firecrawl] ${r.status} on ${vag}, waiting ${vanta} ms`);
    await new Promise((k) => setTimeout(k, Math.min(vanta, 15_000)));
  }

  throw new Error(sistaFel);
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

/**
 * `farsk` bypasses Firecrawl's cache. A monitoring check must, or it compares
 * the cached page against the hash of that same cached page and reports that
 * nothing ever changes.
 */
export async function skrapa(
  url: string,
  val: { farsk?: boolean } = {},
): Promise<Sida | null> {
  try {
    const svar = await anrop<{
      data?: { markdown?: string; metadata?: { title?: string; sourceURL?: string } };
    }>("/scrape", {
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      maxAge: val.farsk ? 0 : 86_400_000,
    });
    const markdown = svar.data?.markdown;
    if (!markdown) return null;
    return {
      url: svar.data?.metadata?.sourceURL ?? url,
      markdown,
      titel: svar.data?.metadata?.title ?? url,
    };
  } catch (e) {
    // One dead page must not kill a five-competitor run — but say why.
    console.error(`[skrapa] ${url}:`, e instanceof Error ? e.message : e);
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
