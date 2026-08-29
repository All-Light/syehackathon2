"use server";

import { hamtaKorning, type Statussvar } from "@/lib/korning";

/**
 * A server action rather than an API route: only this page asks the question,
 * and the answer is the same read the page already does on the server. Nothing
 * else needs the endpoint, so nothing else gets one.
 */
export async function hamtaStatus(id: string): Promise<Statussvar | null> {
  const korning = await hamtaKorning(id);
  if (!korning) return null;
  return { status: korning.status, arbete: korning.arbete, fel: korning.fel };
}
