import Link from "next/link";
import { hamtaRapport } from "@/lib/rapporter";
import Flikar from "./Flikar";

/**
 * One tab bar over three real routes.
 *
 * They are routes rather than client-side tabs because each is a different
 * document: the summary and the full report both print, the full report with
 * its own cover sheet, and a tab you cannot link to is a tab you cannot send
 * to your accountant.
 */
export default async function Rapportlayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sparad = await hamtaRapport(id);

  // A run still in flight has no report yet, and no tabs to offer.
  if (!sparad) return <>{children}</>;

  return (
    <>
      <div className="ej-tryck border-b border-linje bg-papper">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-6 py-4">
          <Link
            href={`/r/${id}`}
            className="font-serif text-xl text-black underline-offset-4 hover:text-amber"
          >
            {sparad.namn}
          </Link>
          <Flikar id={id} harFull={Boolean(sparad.rapport.full)} />
        </div>
      </div>
      {children}
    </>
  );
}
