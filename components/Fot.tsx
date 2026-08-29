import Link from "next/link";

/**
 * The quiet footer. Two links and a word — nothing that competes with the page
 * above it.
 *
 * Marked `ej-tryck` in full: a printed page is a document, and navigation is
 * the one thing a document cannot use.
 */
export default function Fot({ className = "" }: { className?: string }) {
  return (
    <footer className={`ej-tryck border-t border-linje ${className}`}>
      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-baseline justify-between gap-x-6 gap-y-3 px-6 py-8 text-[11px] uppercase tracking-[0.16em] text-dampad">
        <Link href="/" className="transition-colors hover:text-amber">
          Sweep
        </Link>
        <nav className="flex gap-6">
          <Link href="/privacy" className="transition-colors hover:text-amber">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-amber">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
