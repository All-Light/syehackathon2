import { NextResponse } from "next/server";
import { authKlient, sakerVag } from "@/lib/auth";

/**
 * Sign out, then go back where you were.
 *
 * Signing out is not leaving: every page the visitor could read while signed in
 * they can still read afterwards, because reports are addressed by url and not
 * by account. So this returns to the same page rather than to a landing page.
 */

export const dynamic = "force-dynamic";

async function loggaUt(begaran: Request, status: number): Promise<NextResponse> {
  const url = new URL(begaran.url);
  const nasta = sakerVag(url.searchParams.get("next"));
  const vard = begaran.headers.get("x-forwarded-host");
  const bas = vard
    ? `${begaran.headers.get("x-forwarded-proto") ?? "https"}://${vard}`
    : url.origin;

  const klient = await authKlient();
  // Unconfigured, or a session that was already gone: there is nothing to
  // report to the visitor either way — they end up signed out, which is what
  // they asked for.
  if (klient) {
    try {
      await klient.auth.signOut();
    } catch {
      // Auth unreachable. The cookies are stale rather than cleared; a later
      // getUser() rejects them, so the visitor is still signed out here.
    }
  }
  return NextResponse.redirect(new URL(nasta, bas), status);
}

/**
 * The form in Konto posts here — a state change should not sit behind a link.
 *
 * 303, not the default 307: a 307 preserves the method, and the browser would
 * re-POST to the page we are sending it back to.
 */
export async function POST(begaran: Request) {
  return loggaUt(begaran, 303);
}

/** Accepted too, so a plain <a href> works if anyone wires one. */
export async function GET(begaran: Request) {
  return loggaUt(begaran, 307);
}
