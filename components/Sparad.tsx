"use client";

import { useEffect } from "react";
import { sparaTidigare } from "@/lib/tidigare";

/**
 * Records that this browser has seen a report, and draws nothing.
 *
 * Every way into a report counts — a finished run, a shared link, a bookmark,
 * the dashboard — so the recording lives with the report view rather than with
 * the form that started it. Rendering nothing is what lets it be dropped into a
 * server-rendered page without giving hydration anything to disagree about: the
 * write happens in an effect, which never runs on the server.
 */
export default function Sparad({ id, url, namn }: { id: string; url: string; namn: string }) {
  useEffect(() => {
    // Seen again is not a second row: the store moves the existing one back to
    // the top with this timestamp.
    sparaTidigare({ id, url, namn, tid: Date.now() });
  }, [id, url, namn]);

  return null;
}
