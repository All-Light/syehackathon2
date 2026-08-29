import { notFound } from "next/navigation";
import Sparad from "@/components/Sparad";
import { hamtaForandringar } from "@/lib/bevakning";
import { hamtaEpost } from "@/lib/epost";
import { hamtaRapport } from "@/lib/rapporter";
import Bevakningsvy from "./Bevakningsvy";

export const dynamic = "force-dynamic";

/**
 * Where a customer comes back to. The report is a document you read once; this
 * is the thing a monthly subscription is actually for.
 */
export default async function Bevakningssida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sparad = await hamtaRapport(id);
  if (!sparad) notFound();

  const [forandringar, epost] = await Promise.all([
    hamtaForandringar(id),
    hamtaEpost(id),
  ]);

  return (
    <main className="min-h-dvh bg-papper">
      <Sparad id={id} url={sparad.url} namn={sparad.namn} />
      <Bevakningsvy
        id={id}
        rapport={sparad.rapport}
        bevakas={sparad.bevakas}
        forandringar={forandringar}
        skapad={sparad.skapad}
        epost={epost}
      />
    </main>
  );
}
