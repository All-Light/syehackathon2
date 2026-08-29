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
 *
 * Dressed as the console's topbar: 64px, sticky, one hairline under it, the
 * report's name in the display face on the left and the tab row right. It is
 * the only chrome the dashboard has, so it stays on screen while the page
 * scrolls — a console you have to scroll back up to navigate is a document.
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
      <div className="ej-tryck sticky top-0 z-40 border-b border-harlinje bg-papper">
        <div className="mx-auto flex w-full max-w-[880px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:min-h-16 sm:px-6 sm:py-0">
          <Link
            href={`/r/${id}`}
            className="rubrik text-[20px] text-black transition-colors hover:text-amber"
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
