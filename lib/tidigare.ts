/* ---------------------------------------------------------------------------
   Previous research. A run costs two minutes and lives at a url nobody wrote
   down, so the browser remembers every report it has seen — the ones it started
   itself, and equally the ones opened from a shared link, a bookmark or the
   dashboard. Local only: there is no sign-up, so there is nowhere else to put
   it.

   The list is an external store rather than component state, so a page can read
   it through useSyncExternalStore: that hook takes a separate server snapshot,
   which is what makes the empty server HTML and the first client paint agree by
   construction instead of by convention. The obvious alternative — useState([])
   plus a useEffect that fills it in — is also what the project's eslint config
   rejects (react-hooks/set-state-in-effect).
   --------------------------------------------------------------------------- */

/**
 * Versioned, so a later change to the row shape can claim a new key and simply
 * ignore what an old browser left behind instead of having to migrate it.
 */
const LAGERNYCKEL = "sweep.tidigare.v1";

/** Enough to get back to last week's runs, few enough to stay a footer. */
const MAX_TIDIGARE = 8;

/** One report the browser has seen, as much of it as is needed to offer it back. */
export type Tidigare = {
  id: string;
  /** What was typed into the form. Kept as the row's identity, not for display. */
  url: string;
  /** The company the agent read us as. Falls back to the host when unnamed. */
  namn: string;
  /** Epoch ms. Rendered as an age, so no formatted date reaches the markup. */
  tid: number;
};

/** Everything under the key was written by an older build, so trust nothing. */
function arTidigare(v: unknown): v is Tidigare {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    t.id.length > 0 &&
    typeof t.url === "string" &&
    typeof t.namn === "string" &&
    t.namn.length > 0 &&
    typeof t.tid === "number" &&
    Number.isFinite(t.tid)
  );
}

/**
 * "YourCompany.com/", "https://www.yourcompany.com" and "yourcompany.com" are
 * one company to whoever reads this list, so they collapse to one row.
 */
export function urlnyckel(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

/**
 * Never throws, and deliberately not the same as checking for undefined: where
 * site data is blocked the `localStorage` getter itself throws, and on the
 * server the identifier does not exist at all.
 */
function lagret(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Never throws. localStorage is absent on the server, absent in some private
 * windows, and throws outright where site data is blocked — in every one of
 * those cases the honest answer is an empty list, not a broken page.
 */
function lasLagret(): Tidigare[] {
  try {
    const ratt = lagret()?.getItem(LAGERNYCKEL);
    if (!ratt) return [];
    const tolkat: unknown = JSON.parse(ratt);
    if (!Array.isArray(tolkat)) return [];
    const seddaUrler = new Set<string>();
    const seddaIder = new Set<string>();
    return tolkat
      .filter(arTidigare)
      .sort((a, b) => b.tid - a.tid)
      .filter((t) => {
        // An older build may have written duplicates, and the same report can
        // have been stored under two spellings of its url; newest wins.
        const nyckel = urlnyckel(t.url);
        if (seddaUrler.has(nyckel) || seddaIder.has(t.id)) return false;
        seddaUrler.add(nyckel);
        seddaIder.add(t.id);
        return true;
      })
      .slice(0, MAX_TIDIGARE);
  } catch {
    return [];
  }
}

/** One shared empty list, so "nothing stored" is the same value every time. */
const TOMT: Tidigare[] = [];

/** Snapshots are compared by identity, so parsing on every call would loop. */
let cachad: Tidigare[] | null = null;
const lyssnare = new Set<() => void>();

function meddela() {
  for (const pa of lyssnare) pa();
}

/** Subscribe to the list. The returned function unsubscribes. */
export function prenumerera(pa: () => void): () => void {
  lyssnare.add(pa);
  // A report opened in another tab is still this browser's history.
  const vidLagring = (e: StorageEvent) => {
    if (e.key !== null && e.key !== LAGERNYCKEL) return;
    cachad = null;
    meddela();
  };
  const fonster = typeof window === "undefined" ? null : window;
  fonster?.addEventListener("storage", vidLagring);
  return () => {
    lyssnare.delete(pa);
    fonster?.removeEventListener("storage", vidLagring);
  };
}

/** The client snapshot: stable by identity until something actually changes. */
export function hamtaTidigare(): Tidigare[] {
  if (cachad === null) {
    const lista = lasLagret();
    cachad = lista.length > 0 ? lista : TOMT;
  }
  return cachad;
}

/** The server has no localStorage, so empty is the only honest snapshot there. */
export function serverTidigare(): Tidigare[] {
  return TOMT;
}

/**
 * Records a report the browser has seen. Never throws: a full quota or a
 * blocked store costs the reader this browser's list at most, and never the
 * report itself, which is already safe on the server at /r/<id>.
 *
 * A report seen again moves back to the top with a fresh timestamp instead of
 * gaining a second row — the same report reached by two spellings of its url,
 * or two runs of the same company, are one line to whoever reads this list.
 */
export function sparaTidigare(post: Tidigare): void {
  if (!post.id) return;
  const nyckel = urlnyckel(post.url);
  const tidigare = hamtaTidigare();
  const rad: Tidigare = {
    ...post,
    // An unnamed report still deserves a row: reuse whatever name the browser
    // already had for it, then the host, which is what the person typed.
    namn:
      post.namn.trim() ||
      tidigare.find((t) => t.id === post.id)?.namn ||
      nyckel ||
      "Untitled",
    tid: Number.isFinite(post.tid) ? post.tid : Date.now(),
  };
  const lista = [
    rad,
    ...tidigare.filter((t) => t.id !== rad.id && urlnyckel(t.url) !== nyckel),
  ].slice(0, MAX_TIDIGARE);

  cachad = lista;
  meddela();
  try {
    lagret()?.setItem(LAGERNYCKEL, JSON.stringify(lista));
  } catch {
    // Intentionally swallowed. See above.
  }
}
