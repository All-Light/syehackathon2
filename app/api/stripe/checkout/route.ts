import { harStripe, skapaCheckout, type Plan, kopAktivt } from "@/lib/stripe";

export async function POST(req: Request) {
  if (!kopAktivt()) {
    return Response.json({ fel: "Sales are not open yet." }, { status: 403 });
  }
  const { id, plan } = (await req.json()) as { id?: string; plan?: Plan };
  if (!id) return Response.json({ fel: "Missing report id." }, { status: 400 });
  if (plan !== "rapport" && plan !== "bevakning") {
    return Response.json({ fel: "Unknown plan." }, { status: 400 });
  }

  // Same graceful degradation as db(): a missing key is a configuration
  // problem, not a crash the customer should see as a blank page.
  if (!harStripe()) {
    return Response.json({ fel: "Payments are not configured." }, { status: 503 });
  }

  const ursprung = req.headers.get("origin") ?? new URL(req.url).origin;

  try {
    const { url } = await skapaCheckout(id, plan, ursprung);
    return Response.json({ url });
  } catch (fel) {
    return Response.json(
      { fel: fel instanceof Error ? fel.message : "Could not start checkout." },
      { status: 502 },
    );
  }
}
