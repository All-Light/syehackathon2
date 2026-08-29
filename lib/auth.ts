import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "./db";

/**
 * Accounts. Optional, and deliberately so.
 *
 * The product's identity model is "the report url is the account": anyone
 * holding a link reads the report. Signing in adds one thing on top — a list of
 * the reports that are *mine* — and takes nothing away. Every function here
 * returns null/false/[] rather than throwing when Supabase Auth is not
 * configured or nobody is signed in, so a signed-out visitor walks exactly the
 * same path through the app as before this file existed.
 *
 * This is NOT lib/db.ts. That client holds the secret key, bypasses RLS and has
 * no idea who is asking; it is the right tool for reading and writing reports
 * and the wrong tool for a user session. The client below holds the publishable
 * (anon) key and keeps its session in cookies, which is what a browser session
 * actually is.
 */

const URL =
  process.env.SUPABASE_URL ??
  (process.env.SUPABASE_PROJECT_ID
    ? `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`
    : undefined);

// The publishable/anon key — safe by design to hand to a browser, unlike
// SUPABASE_API_KEY. Several names accepted because Supabase renamed this key
// mid-flight (anon → publishable) and a project may carry either.
const NYCKEL =
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type Anvandare = {
  id: string;
  /** Verified by the identity provider, unlike koll_rapporter.epost. */
  epost: string | null;
};

/** A report as the "my reports" list needs it — without the heavy jsonb body. */
export type MinRapport = {
  id: string;
  skapad: string;
  url: string;
  namn: string;
  bevakas: boolean;
  betald: boolean;
};

/**
 * Whether sign-in can work at all. Callers use it to hide a control that would
 * only lead to an error page — a missing key is our problem, not the visitor's.
 */
export function authKonfigurerad(): boolean {
  return Boolean(URL && NYCKEL);
}

/**
 * A cookie-backed Supabase client for the current request. Null when unconfigured.
 *
 * Must be built per request and never shared: the cookies *are* the session.
 * `setAll` throws inside a server component, where the response headers are
 * already gone — that is expected and swallowed, because middleware.ts is what
 * writes refreshed tokens back.
 */
export async function authKlient(): Promise<SupabaseClient | null> {
  if (!URL || !NYCKEL) return null;
  const burk = await cookies();
  return createServerClient(URL, NYCKEL, {
    cookies: {
      getAll: () => burk.getAll(),
      setAll: (kakor) => {
        try {
          for (const { name, value, options } of kakor) burk.set(name, value, options);
        } catch {
          // Server component render: cookies are read-only here.
        }
      },
    },
  });
}

/**
 * The signed-in user, or null. Never throws.
 *
 * Request-scoped, like hamtaRapport: a header, a page and a claim in the same
 * render ask this three times and should cost one round-trip.
 *
 * Uses getUser(), not getSession(): getSession() trusts whatever the cookie
 * says, getUser() asks the auth server whether the token is real.
 */
export const hamtaAnvandare = cache(async function hamtaAnvandare(): Promise<Anvandare | null> {
  const klient = await authKlient();
  if (!klient) return null;
  try {
    const { data, error } = await klient.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, epost: data.user.email ?? null };
  } catch {
    // Auth being down must not take the report down with it.
    return null;
  }
});

/**
 * Attaches an unowned report to the signed-in user.
 *
 * `.is("anvandare", null)` is the whole safety model: claiming is first-come,
 * and a report that already has an owner is never reassigned by someone who
 * merely holds the link. Returns false rather than throwing on every miss —
 * not signed in, no database, already owned by somebody else.
 *
 * The write goes through the secret-key client because the tables have RLS on
 * with zero policies; the ownership check above is done in the query, not by
 * the database.
 */
export async function taRapport(rapportId: string): Promise<boolean> {
  const anvandare = await hamtaAnvandare();
  if (!anvandare) return false;
  const klient = db();
  if (!klient) return false;
  const { data, error } = await klient
    .from("koll_rapporter")
    .update({ anvandare: anvandare.id })
    .eq("id", rapportId)
    .is("anvandare", null)
    .select("id");
  return !error && Boolean(data?.length);
}

/** True if this report is already the signed-in user's. Cheap, no body read. */
export async function agerRapport(rapportId: string): Promise<boolean> {
  const anvandare = await hamtaAnvandare();
  if (!anvandare) return false;
  const klient = db();
  if (!klient) return false;
  const { data, error } = await klient
    .from("koll_rapporter")
    .select("id")
    .eq("id", rapportId)
    .eq("anvandare", anvandare.id)
    .maybeSingle();
  return !error && Boolean(data);
}

/** The signed-in user's reports, newest first. Empty for a signed-out visitor. */
export async function hamtaMinaRapporter(grans = 50): Promise<MinRapport[]> {
  const anvandare = await hamtaAnvandare();
  if (!anvandare) return [];
  const klient = db();
  if (!klient) return [];
  const { data, error } = await klient
    .from("koll_rapporter")
    .select("id, skapad, url, namn, bevakas, betald")
    .eq("anvandare", anvandare.id)
    .order("skapad", { ascending: false })
    .limit(grans);
  if (error || !data) return [];
  return data as MinRapport[];
}

/**
 * Whether the Google provider is actually switched on in this project.
 *
 * Worth one round-trip before sending anybody to Google, because Supabase's
 * answer to a disabled provider is a bare 400 on its own domain — the visitor
 * lands on a json error page with no way back, which is a worse thing to show
 * than a sentence. Asking first lets the refusal happen on our page instead.
 *
 * Returns null when the question could not be answered at all (auth down,
 * request timed out). Callers treat null as "go ahead": a check that cannot
 * run must not be the reason sign-in stops working.
 */
export async function googleAktiverad(): Promise<boolean | null> {
  if (!URL || !NYCKEL) return false;
  try {
    const svar = await fetch(`${URL}/auth/v1/settings`, {
      headers: { apikey: NYCKEL },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!svar.ok) return null;
    const data = (await svar.json()) as { external?: Record<string, boolean | undefined> };
    return Boolean(data.external?.google);
  } catch {
    return null;
  }
}

/**
 * Sanitises a `next=` parameter into a path we are willing to redirect to.
 *
 * An OAuth round-trip carries the return address through a third party, so it
 * has to come home as data, not as trust: anything that is not a plain
 * same-origin path — an absolute url, a protocol-relative `//evil.com` — is
 * thrown away and replaced with the front page.
 */
export function sakerVag(vag: string | null | undefined): string {
  if (!vag || !vag.startsWith("/") || vag.startsWith("//")) return "/";
  return vag;
}
