import { cache } from "react";
import { db } from "./db";

/* ---------------------------------------------------------------------------
   E-post. The customer has no account, so the report url is their identity and
   we have no way back to a person who closed the tab. An address left on a
   report is that thread — nothing more: no mail provider is configured, so this
   module stores and reads, and never sends.
   --------------------------------------------------------------------------- */

/**
 * Deliberately not RFC 5322. The job here is to reject what is obviously not an
 * address — a name, a url, a sentence, a second address pasted after a comma —
 * without turning away the odd real one. Anything stricter costs us real
 * customers to protect a column nobody sends mail from.
 *
 * Applied after lowercasing, hence the ascii-only domain.
 */
const EPOSTMONSTER =
  /^[^\s@,;:<>"()[\]\\]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

/** The longest address SMTP will carry, so the longest worth storing. */
const MAXLANGD = 254;

/**
 * The client is never trusted: this runs again on whatever the route received,
 * whoever sent it. Returns the address as it should be stored — trimmed and
 * lowercased, so "  Anna@Example.COM " and "anna@example.com" are one person —
 * or null when it is not an address at all.
 */
export function giltigEpost(varde: unknown): string | null {
  if (typeof varde !== "string") return null;
  const adress = varde.trim().toLowerCase();
  if (adress.length === 0 || adress.length > MAXLANGD) return null;
  // A dot at either end of a label is invalid and the pattern above is happy to
  // allow ".." inside the local part, so rule it out here rather than making the
  // pattern unreadable.
  if (adress.includes("..")) return null;
  if (!EPOSTMONSTER.test(adress)) return null;
  return adress;
}

/**
 * Attaches an address to a report. Returns the stored address, or null when
 * nothing was stored — no Supabase, no such report, or not an address.
 *
 * A second, different address replaces the first. With the link as the only
 * identity there is no way to tell a stranger from the owner fixing a typo, and
 * refusing the correction would leave the customer permanently unreachable
 * while showing them an address they have already told us is wrong. One report,
 * one address, last one wins — and the caller is handed back what is actually
 * stored so the page can say so rather than guess.
 */
export async function sparaEpost(id: string, epost: unknown): Promise<string | null> {
  const adress = giltigEpost(epost);
  if (!adress || !id) return null;

  const klient = db();
  if (!klient) return null;

  // Selecting back is what makes an unknown id a failure: an update that
  // matches no row is not an error to Postgres, and silently reporting success
  // would lose the address without anyone noticing.
  const { data, error } = await klient
    .from("koll_rapporter")
    .update({ epost: adress })
    .eq("id", id)
    .select("epost");

  if (error || !data || data.length === 0) return null;
  return adress;
}

/**
 * Request-scoped, like hamtaRapport: the report view and anything above it can
 * both ask without costing a second round-trip.
 */
export const hamtaEpost = cache(async function hamtaEpost(id: string): Promise<string | null> {
  const klient = db();
  if (!klient || !id) return null;
  const { data, error } = await klient
    .from("koll_rapporter")
    .select("epost")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return (data.epost as string | null) ?? null;
});
