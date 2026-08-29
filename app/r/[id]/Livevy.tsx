"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Arbetsvy from "@/components/Arbetsvy";
import type { Arbete } from "@/lib/korning";
import { hamtaStatus } from "./status";

/** Slower than the stream, fast enough that a phone feels attached to the run. */
const INTERVALL_MS = 2500;

/**
 * Someone reloaded, or opened the link on another phone, while the agent is
 * still working. They get the same working view as the tab that started it —
 * seeded from the run's row, then kept moving by polling.
 *
 * Polling rather than re-attaching to the stream: the stream is owned by one
 * function call producing one run, and a second reader would start a second
 * hundred-second analysis.
 */
export default function Livevy({ id, start }: { id: string; start: Arbete }) {
  const [arbete, sattArbete] = useState<Arbete>(start);
  const [fel, sattFel] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let levande = true;
    let timer: ReturnType<typeof setTimeout>;

    async function fraga() {
      const svar = await hamtaStatus(id).catch(() => null);
      if (!levande) return;

      if (svar) {
        sattArbete(svar.arbete);
        if (svar.status === "klar") {
          // The report row is written before the status flips, so the server
          // render this triggers is guaranteed to find it.
          router.refresh();
          // The report is the thing they waited two minutes for. If the soft
          // refresh does not land — stale router cache, dropped payload on a
          // train — take the page the blunt way rather than sit on a finished
          // run showing progress.
          timer = setTimeout(() => levande && window.location.reload(), 4000);
          return;
        }
        if (svar.status === "fel") {
          sattFel(svar.fel ?? "The analysis stopped before it finished.");
          return;
        }
      }

      // A null answer is a blip, not a verdict — the run marks itself dead.
      timer = setTimeout(fraga, INTERVALL_MS);
    }

    timer = setTimeout(fraga, INTERVALL_MS);
    return () => {
      levande = false;
      clearTimeout(timer);
    };
  }, [id, router]);

  if (fel) return <Avbruten namn={arbete.foretag} fel={fel} />;

  return (
    <Arbetsvy rader={arbete.rader} kandidater={arbete.kandidater} foretag={arbete.foretag} />
  );
}

/**
 * Exported so the server page can say the same thing for a run that was already
 * dead when the page was requested.
 */
export function Avbruten({ namn, fel }: { namn: string | null; fel: string }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <span className="text-[11px] uppercase tracking-[0.16em] text-rod">Unfinished</span>
        <h1 className="font-serif text-4xl leading-tight text-black sm:text-5xl">
          {namn ? `The analysis of ${namn} did not finish` : "This analysis did not finish"}
        </h1>
        <p className="text-lg leading-relaxed text-dampad">{fel}</p>
      </div>
      <p className="text-[15px] leading-relaxed text-dampad">
        Nothing was charged and nothing was saved. Running it again usually works —
        most failures here are a site that would not load in time.
      </p>
      <Link
        href="/"
        className="ej-tryck self-start border border-linje px-6 py-3 text-black transition-colors hover:border-amber hover:text-amber"
      >
        Start a new analysis
      </Link>
    </div>
  );
}
