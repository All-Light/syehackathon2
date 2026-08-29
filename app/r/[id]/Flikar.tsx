"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Client-side only to know which route is active. The links themselves are
 * ordinary navigations — the tab bar is chrome, not state.
 *
 * Console pills rather than the paper world's tracked underlines: the active
 * tab is a filled elevated surface, the rest are ghosts that take the same
 * fill on hover, so the row has one raised thing in it and no ambiguity about
 * which. Their chip spec — elevated fill, small radius, 12.5px medium.
 */
export default function Flikar({ id, harFull }: { id: string; harFull: boolean }) {
  const vag = usePathname();
  const bas = `/r/${id}`;

  const flikar = [
    { href: bas, etikett: "Summary" },
    { href: `${bas}/bevakning`, etikett: "Dashboard" },
    { href: `${bas}/full`, etikett: harFull ? "Full report" : "Full report" },
  ];

  return (
    <nav className="-mx-1 flex flex-wrap items-center gap-1">
      {flikar.map((f) => {
        const aktiv = vag === f.href;
        return (
          <Link
            key={f.href}
            href={f.href}
            aria-current={aktiv ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              aktiv
                ? "bg-upphojd text-black"
                : "text-dampad hover:bg-upphojd/60 hover:text-black"
            }`}
          >
            {f.etikett}
          </Link>
        );
      })}
    </nav>
  );
}
