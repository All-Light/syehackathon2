/**
 * Stripe over plain fetch. The npm package pulls in a lot for the three calls
 * we make, and Stripe's REST API is form-encoded rather than JSON — hence the
 * bracket keys below, which is how Stripe expects nested params.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const BAS = "https://api.stripe.com/v1";
const TIMEOUT = Number(process.env.STRIPE_TIMEOUT_MS ?? 20_000);

export type Plan = "rapport" | "bevakning";

/** Öre, since Stripe counts SEK in minor units. */
/**
 * Amounts are in öre. `ordinarie` is what the thing costs; `belopp` is what we
 * charge today. The two differ while the early-bird price is running, and the
 * gap is the offer — so both are exported and the page shows both.
 */
export const ORDINARIE_RAPPORT = 100_000;

export const PRISER: Record<Plan, { belopp: number; namn: string; manatlig: boolean }> = {
  rapport: { belopp: 50_000, namn: "Sweep competitor report (early bird)", manatlig: false },
  bevakning: { belopp: 100_000, namn: "Sweep monitoring", manatlig: true },
};

/**
 * Selling is off until it is switched on. Read on the server by the checkout
 * route and inlined into the client bundle for the button, so one variable
 * governs both and there is no state where the button works but the route
 * refuses. Next inlines NEXT_PUBLIC_* at build time, so flipping it needs a
 * redeploy — which is the point: turning sales on should be deliberate.
 */
export function kopAktivt(): boolean {
  return process.env.NEXT_PUBLIC_KOP_AKTIV === "1";
}

export function harStripe(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function formKoda(data: Record<string, string | number>): string {
  const p = new URLSearchParams();
  for (const [n, v] of Object.entries(data)) p.set(n, String(v));
  return p.toString();
}

async function stripePost(vag: string, data: Record<string, string | number>) {
  const nyckel = process.env.STRIPE_SECRET_KEY;
  if (!nyckel) throw new Error("STRIPE_SECRET_KEY is missing from the environment.");

  const r = await fetch(`${BAS}${vag}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${nyckel}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formKoda(data),
    signal: AbortSignal.timeout(TIMEOUT),
  });

  const svar = (await r.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!r.ok) throw new Error(`Stripe responded ${r.status}: ${svar.error?.message ?? "unknown error"}`);
  return svar;
}

export async function skapaCheckout(
  id: string,
  plan: Plan,
  ursprung: string,
): Promise<{ id: string; url: string }> {
  const pris = PRISER[plan];
  const data: Record<string, string | number> = {
    mode: pris.manatlig ? "subscription" : "payment",
    success_url: `${ursprung}/r/${id}?betald=1`,
    cancel_url: `${ursprung}/r/${id}`,
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": "sek",
    "line_items[0][price_data][unit_amount]": pris.belopp,
    "line_items[0][price_data][product_data][name]": pris.namn,
    "metadata[rapportId]": id,
    "metadata[plan]": plan,
  };

  // Subscriptions carry the metadata on the subscription too, so a later
  // invoice event can still be traced back to the report.
  if (pris.manatlig) {
    data["line_items[0][price_data][recurring][interval]"] = "month";
    data["subscription_data[metadata][rapportId]"] = id;
    data["subscription_data[metadata][plan]"] = plan;
  } else {
    data["payment_intent_data[metadata][rapportId]"] = id;
  }

  const svar = await stripePost("/checkout/sessions", data);
  if (!svar.id || !svar.url) throw new Error("Stripe returned a session without a URL.");
  return { id: svar.id, url: svar.url };
}

/**
 * Stripe signs `<timestamp>.<raw body>`, so this only works on the untouched
 * request text — a JSON round-trip changes the bytes and breaks the digest.
 */
export function verifieraSignatur(
  rakBody: string,
  rubrik: string | null,
  hemlighet: string,
): boolean {
  if (!rubrik) return false;

  const delar = Object.fromEntries(
    rubrik.split(",").map((d) => {
      const n = d.indexOf("=");
      return [d.slice(0, n).trim(), d.slice(n + 1)];
    }),
  );
  const t = delar.t;
  const v1 = delar.v1;
  if (!t || !v1) return false;

  const vantad = createHmac("sha256", hemlighet).update(`${t}.${rakBody}`).digest("hex");
  const a = Buffer.from(vantad);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
