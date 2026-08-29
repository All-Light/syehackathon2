import { notFound } from "next/navigation";
import Rapportvy from "@/components/Rapportvy";
import { hamtaKorning } from "@/lib/korning";
import { hamtaRapport } from "@/lib/rapporter";
import Livevy, { Avbruten } from "./Livevy";

export const dynamic = "force-dynamic";

/**
 * One address for the whole life of an analysis: the run and the report it turns
 * into share an id, so a link handed out ten seconds in still works two minutes
 * later — and shows the work in the meantime.
 */
export default async function DeladRapport({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const sparad = await hamtaRapport(id);
  if (sparad) {
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

  // No report under this id. Either the agent is still working on it — someone
  // reloaded on the train — or it never got that far.
  const korning = await hamtaKorning(id);
  if (!korning) notFound();

  return (
    <main className="min-h-dvh bg-papper">
      {korning.status === "kor" ? (
        <Livevy id={id} start={korning.arbete} />
      ) : (
        <Avbruten
          namn={korning.namn}
          fel={korning.fel ?? "The analysis stopped before it finished."}
        />
      )}
    </main>
  );
}
