import { NextResponse } from "next/server";
import { authKlient, sakerVag } from "@/lib/auth";

/**
 * The Google round-trip, both ends of it.
 *
 * One route rather than two because the two ends are one conversation, and
 * because the PKCE code verifier the start writes into a cookie is the only
 * thing that lets the finish redeem the code. Hitting it with no `code`
 * *starts* a sign-in; coming back from Google with one *finishes* it.
 *
 * It never renders an error itself. Everything — a disabled provider, a stale
 * code, a visitor who pressed cancel — comes home to the page the visitor
 * started on with `?auth_fel=<message>`, which Konto shows and then scrubs out
 * of the address bar. A failed sign-in must leave someone exactly where a
 * signed-out visitor already is: reading the site.
 */

// Cookies and a code exchange: there is nothing here to cache or prerender.
export const dynamic = "force-dynamic";

/**
 * Behind Vercel the request url says the internal host, and an OAuth
 * redirect_uri that does not match what the browser is looking at is a dead
 * end. The forwarded headers are what the browser actually asked for.
 */
function ursprung(begaran: Request, url: URL): string {
  const huvuden = begaran.headers;
  const vard = huvuden.get("x-forwarded-host");
  if (!vard) return url.origin;
  const protokoll = huvuden.get("x-forwarded-proto") ?? "https";
  return `${protokoll}://${vard}`;
}

function hem(bas: string, nasta: string, fel?: string): NextResponse {
  const mal = new URL(nasta, bas);
  if (fel) mal.searchParams.set("auth_fel", fel);
  return NextResponse.redirect(mal);
}

export async function GET(begaran: Request) {
  const url = new URL(begaran.url);
  const bas = ursprung(begaran, url);
  const nasta = sakerVag(url.searchParams.get("next"));

  // Google (or Supabase, when the provider is switched off) hands its refusal
  // back in the query string rather than in a status code.
  const avvisad =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (avvisad) return hem(bas, nasta, avvisad);

  const klient = await authKlient();
  if (!klient) {
    return hem(bas, nasta, "Sign-in is not configured on this deployment yet.");
  }

  const kod = url.searchParams.get("code");

  // No code: this is the start of a sign-in, not the end of one. Building the
  // authorize url server-side is what writes the code verifier cookie.
  if (!kod) {
    const { data, error } = await klient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${bas}/auth/callback?next=${encodeURIComponent(nasta)}` },
    });
    if (error || !data?.url) {
      return hem(bas, nasta, error?.message ?? "Could not start sign-in.");
    }
    return NextResponse.redirect(data.url);
  }

  const { error } = await klient.auth.exchangeCodeForSession(kod);
  if (error) {
    // Typically a code that was already used or has expired — a refresh of this
    // url, or a link opened twice.
    return hem(bas, nasta, "That sign-in link is no longer valid. Please try again.");
  }
  return hem(bas, nasta);
}
