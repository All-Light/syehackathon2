import Link from "next/link";
import { notFound } from "next/navigation";
import Fullrapport from "@/components/Fullrapport";
import { Framsida, Kallor } from "@/components/Tryck";
import { hamtaRapport } from "@/lib/rapporter";

export const dynamic = "force-dynamic";

/**
 * The full report has its own address.
 *
 * It is a different document from the summary — longer, argued, meant to be
 * printed and handed to someone — so it gets its own page and its own cover
 * sheet rather than living at the bottom of a scroll. It also means the link
 * can be sent to a colleague on its own.
 */
export default async function FullSida({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ skriv?: string }>;
}) {
  const { id } = await params;
  const { skriv } = await searchParams;
  const sparad = await hamtaRapport(id);
  if (!sparad) notFound();

  const utveckling = process.env.NODE_ENV !== "production";

  return (
    <main className="min-h-dvh bg-papper">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
        <Link
          href={`/r/${id}`}
          className="ej-tryck self-start text-[11px] uppercase tracking-[0.16em] text-dampad underline-offset-4 hover:text-amber hover:underline"
        >
          ← {sparad.namn} · summary
        </Link>

        <Framsida rapport={sparad.rapport} />

        <Fullrapport
          id={id}
          namn={sparad.rapport.egen.namn}
          befintlig={sparad.rapport.full}
          kanKopa={sparad.betald || utveckling}
          /* Read on the server so it reflects the address this page was
             requested with. The component clears it from the address as soon as
             it acts on it, so a reload mid-run arrives here without it. */
          skrivDirekt={skriv === "1"}
        />

        <Kallor rapport={sparad.rapport} />
      </div>
    </main>
  );
}
