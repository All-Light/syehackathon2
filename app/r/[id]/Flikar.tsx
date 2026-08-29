"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Client-side only to know which route is active. The links themselves are
 * ordinary navigations — the tab bar is chrome, not state.
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
    <nav className="flex flex-wrap gap-6">
      {flikar.map((f) => {
        const aktiv = vag === f.href;
        return (
          <Link
            key={f.href}
            href={f.href}
            aria-current={aktiv ? "page" : undefined}
            className={`border-b-2 pb-1 text-[11px] uppercase tracking-[0.16em] transition-colors ${
              aktiv
                ? "border-amber text-black"
                : "border-transparent text-dampad hover:text-black"
            }`}
          >
            {f.etikett}
          </Link>
        );
      })}
    </nav>
  );
}
