import type { Kalla } from "./types";

/**
 * We republish other companies' words in a document we sell, so a quote has to
 * stay an excerpt: short enough to prove the claim and no longer. The model is
 * told this, but a prompt is a request and this is the enforcement.
 */
const TAK_ORD = 20;

export function kortaCitat(rå: string): string {
  const ord = rå.trim().split(/\s+/);
  if (ord.length <= TAK_ORD) return rå.trim();
  // The ellipsis is the honest signal that this is an excerpt, not the sentence.
  return `${ord.slice(0, TAK_ORD).join(" ")}…`;
}

/**
 * One quote per page. Later findings from the same page keep their text and
 * lose the quote — the claim still stands, it just cites rather than reproduces.
 */
export function enPerKalla<T extends { kalla: Kalla | null }>(poster: T[]): T[] {
  const anvanda = new Set<string>();
  return poster.map((p) => {
    if (!p.kalla) return p;
    if (anvanda.has(p.kalla.url)) return { ...p, kalla: null };
    anvanda.add(p.kalla.url);
    return { ...p, kalla: { ...p.kalla, citat: kortaCitat(p.kalla.citat) } };
  });
}
