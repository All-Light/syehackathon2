/**
 * The Internet Archive, as a source of history we never captured ourselves.
 *
 * Monitoring can only tell a customer what has changed since they arrived. The
 * archive already watched these pages for years, so a report can open with real
 * dated movement instead of an empty table — and a row that cites a capture is
 * more checkable than one citing a live page, because the live page has already
 * moved on and the capture has not.
 *
 * Firecrawl cannot reach web.archive.org (its proxy fails to tunnel), so this
 * fetches directly. That also means it costs no Firecrawl quota.
 */
const TIMEOUT = Number(process.env.WAYBACK_TIMEOUT_MS ?? 45_000);

export type Ögonblick = {
  /** What the archive actually holds, which is rarely the date we asked for. */
  datum: string;
  arkivUrl: string;
};

function stampel(dagarSedan: number): string {
  const d = new Date(Date.now() - dagarSedan * 86_400_000);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * `id_` asks for the original bytes without the archive's own toolbar, so what
 * we extract is the page as it was, not the page inside a frame.
 */
function utanVerktygsfalt(url: string): string {
  return url.replace(/\/web\/(\d+)\//, "/web/$1id_/");
}

async function narmaste(url: string, dagarSedan: number): Promise<Ögonblick | null> {
  try {
    const r = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=${stampel(dagarSedan)}`,
      { signal: AbortSignal.timeout(TIMEOUT) },
    );
    if (!r.ok) return null;
    const d = (await r.json()) as {
      archived_snapshots?: { closest?: { timestamp: string; status: string; url: string } };
    };
    const n = d.archived_snapshots?.closest;
    if (!n || n.status !== "200") return null;

    const t = n.timestamp;
    return {
      datum: `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`,
      arkivUrl: utanVerktygsfalt(n.url.replace(/^http:/, "https:")),
    };
  } catch {
    return null;
  }
}

/**
 * Asking for 30, 60 and 90 days back returns whatever exists nearest, which can
 * be the same capture three times or one from a year earlier. Deduplicate, and
 * carry the real date so nothing is ever labelled with a date we merely wanted.
 */
export async function hittaOgonblick(
  url: string,
  dagar = [90, 60, 30],
): Promise<Ögonblick[]> {
  const funna = await Promise.all(dagar.map((d) => narmaste(url, d)));
  const sedda = new Set<string>();
  return funna
    .filter((o): o is Ögonblick => o !== null)
    .filter((o) => (sedda.has(o.datum) ? false : (sedda.add(o.datum), true)))
    .sort((a, b) => a.datum.localeCompare(b.datum));
}

/** Archive HTML reduced to readable text. Good enough to read prices out of. */
export async function hamtaArkiverad(arkivUrl: string): Promise<string | null> {
  try {
    const r = await fetch(arkivUrl, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { "User-Agent": "Sweep/1.0 (competitor analysis; +https://syehackathon.vercel.app)" },
    });
    if (!r.ok) return null;
    const html = await r.text();

    const text = html
      .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|div|li|tr|h[1-6]|section)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // A capture that redirected to an error page is not history.
    return text.length > 400 ? text : null;
  } catch {
    return null;
  }
}
