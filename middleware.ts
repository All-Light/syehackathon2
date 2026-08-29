import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Keeps a signed-in session alive. Nothing else.
 *
 * There are no redirects here and there never should be: every page of this
 * product is readable signed out, so middleware that turned anyone away would
 * be breaking the product, not protecting it.
 *
 * It exists because a Supabase access token lasts an hour and a server
 * component cannot write cookies. Without a place that *can* write them, the
 * first render after expiry rotates the refresh token and then loses the new
 * one — the visitor is silently signed out and has to sign in again. This is
 * that place.
 *
 * Cost for an anonymous visitor, which is almost everyone: one cookie-name
 * check and out. No client is built, no network call is made.
 */

const URL =
  process.env.SUPABASE_URL ??
  (process.env.SUPABASE_PROJECT_ID
    ? `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`
    : undefined);

const NYCKEL =
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function middleware(begaran: NextRequest) {
  const svar = NextResponse.next({ request: begaran });
  if (!URL || !NYCKEL) return svar;

  // Supabase names its session cookies sb-<ref>-auth-token. No such cookie
  // means nobody is signed in, and there is nothing to refresh.
  const harSession = begaran.cookies.getAll().some((k) => k.name.startsWith("sb-"));
  if (!harSession) return svar;

  try {
    const klient = createServerClient(URL, NYCKEL, {
      cookies: {
        getAll: () => begaran.cookies.getAll(),
        setAll: (kakor, huvuden) => {
          for (const { name, value, options } of kakor) svar.cookies.set(name, value, options);
          // Supabase asks for these when it writes a token: a response carrying
          // somebody's session cookie must never be served from a CDN cache to
          // the next visitor.
          for (const [namn, varde] of Object.entries(huvuden ?? {})) {
            svar.headers.set(namn, varde);
          }
        },
      },
    });
    // The call itself is the point — it refreshes if needed, and setAll above
    // writes the result onto this response.
    await klient.auth.getUser();
  } catch {
    // Auth being unreachable must not turn into a 500 on a page that does not
    // need auth in the first place.
  }

  return svar;
}

export const config = {
  // Everything except build output and files served as-is.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
