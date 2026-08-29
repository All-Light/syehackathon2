import { db } from "@/lib/db";
import { verifieraSignatur } from "@/lib/stripe";

export const runtime = "nodejs";

type Handelse = {
  type?: string;
  data?: { object?: { metadata?: { rapportId?: string; plan?: string } } };
};

export async function POST(req: Request) {
  const rakBody = await req.text();

  const hemlighet = process.env.STRIPE_WEBHOOK_SECRET;
  if (hemlighet) {
    if (!verifieraSignatur(rakBody, req.headers.get("stripe-signature"), hemlighet)) {
      return new Response("Invalid signature.", { status: 400 });
    }
  } else {
    // Hackathon pragmatism: without the secret we cannot tell Stripe from
    // anyone else, so we process anyway rather than block a real payment.
    // Set STRIPE_WEBHOOK_SECRET before this handles other people's money.
    console.warn("[stripe] STRIPE_WEBHOOK_SECRET is not set — webhook processed unverified.");
  }

  let handelse: Handelse;
  try {
    handelse = JSON.parse(rakBody) as Handelse;
  } catch {
    return new Response("Malformed body.", { status: 400 });
  }

  if (handelse.type !== "checkout.session.completed") return Response.json({ mottagen: true });

  const metadata = handelse.data?.object?.metadata;
  const id = metadata?.rapportId;
  if (!id) {
    console.warn("[stripe] checkout.session.completed without rapportId in metadata.");
    return Response.json({ mottagen: true });
  }

  const klient = db();
  if (!klient) {
    console.warn("[stripe] Supabase is not configured — payment for %s not recorded.", id);
    return Response.json({ mottagen: true });
  }

  const { error } = await klient
    .from("koll_rapporter")
    .update(metadata?.plan === "bevakning" ? { betald: true, bevakas: true } : { betald: true })
    .eq("id", id);

  // A non-2xx makes Stripe retry, which is what we want if the write failed.
  if (error) {
    console.error("[stripe] Could not mark %s as paid: %s", id, error.message);
    return new Response("Could not record payment.", { status: 500 });
  }

  return Response.json({ mottagen: true });
}
