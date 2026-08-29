"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

/**
 * The failure the callback route handed back, read straight off the address bar.
 *
 * useSyncExternalStore rather than an effect or useSearchParams: the url is
 * external mutable state, this is the api React has for that, and its server
 * snapshot is what keeps hydration honest — the server has no window, renders
 * nothing, and the message appears once the client takes over. useSearchParams
 * would instead demand a Suspense boundary in every page this drops into.
 */
function prenumerera(uppdatera: () => void): () => void {
  window.addEventListener("popstate", uppdatera);
  return () => window.removeEventListener("popstate", uppdatera);
}

function lasFel(): string | null {
  return new URLSearchParams(window.location.search).get("auth_fel");
}

/**
 * The account control. Signed out it offers Google; signed in it shows who you
 * are and lets you leave.
 *
 * It draws no gate. Nothing in this component decides what a visitor may read —
 * a report url works signed in, signed out, and on a deployment where sign-in
 * was never configured. It only ever adds the one thing an account is for:
 * knowing which of these reports are yours.
 *
 * State comes in as a prop rather than being fetched here, because the pages
 * this sits in are server-rendered and already know the answer:
 *
 *   const anvandare = await hamtaAnvandare();
 *   <Konto epost={anvandare?.epost ?? null} aktiv={authKonfigurerad()} />
 *
 * Both props have defaults, so a bare <Konto /> renders the signed-out state
 * instead of breaking.
 */
export default function Konto({
  epost = null,
  aktiv = true,
}: {
  /** The signed-in address, or null for a signed-out visitor. */
  epost?: string | null;
  /** False when Supabase Auth is unconfigured — the control then hides itself. */
  aktiv?: boolean;
}) {
  const vag = usePathname();
  const fel = useSyncExternalStore(prenumerera, lasFel, () => null);
  const [vantar, sattVantar] = useState(false);

  // A sign-in button that cannot possibly work is worse than no button: the
  // missing key is ours to fix, not something to show a visitor.
  if (!aktiv) return null;

  // Where to come back to. usePathname deliberately, not the full url: the
  // return address survives a round-trip through Google, so it stays as small
  // and as plainly ours as possible.
  const tillbaka = encodeURIComponent(vag || "/");

  return (
    <div className="ej-tryck flex flex-col items-end gap-1.5">
      {epost ? (
        <div className="flex items-center gap-3">
          <span className="max-w-[14rem] truncate text-sm text-dampad" title={epost}>
            {epost}
          </span>
          <form
            method="post"
            action={`/api/auth/signout?next=${tillbaka}`}
            onSubmit={() => sattVantar(true)}
          >
            <button
              type="submit"
              disabled={vantar}
              className="text-sm text-amber underline-offset-4 transition-colors hover:text-black hover:underline disabled:opacity-50"
            >
              {vantar ? "Signing out…" : "Sign out"}
            </button>
          </form>
        </div>
      ) : (
        <a
          href={`/auth/callback?next=${tillbaka}`}
          className="border border-linje px-3 py-1.5 text-sm text-black transition-colors hover:border-amber hover:text-amber"
        >
          Sign in with Google
        </a>
      )}
      {fel && (
        <p className="max-w-xs text-right text-sm text-rod" role="status">
          {fel}
        </p>
      )}
    </div>
  );
}

export { Konto };
