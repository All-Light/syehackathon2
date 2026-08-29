import { notFound } from "next/navigation";
import Rapportvy from "@/components/Rapportvy";
import { hamtaRapport } from "@/lib/rapporter";

export const dynamic = "force-dynamic";

export default async function DeladRapport({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sparad = await hamtaRapport(id);
  if (!sparad) notFound();

  return (
    <main className="min-h-dvh bg-papper">
      <Rapportvy
        rapport={sparad.rapport}
        id={sparad.id}
        bevakasFran={sparad.bevakas}
        betald={sparad.betald}
      />
    </main>
  );
}
