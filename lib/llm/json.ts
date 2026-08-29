/** Small fast models sometimes fence their JSON. Recover rather than fail. */
export function plockaJson(raw: string): unknown {
  const utanAnsi = raw.replace(/\[[0-9;]*m/g, "");
  const fence = utanAnsi.match(/```(?:json)?\s*([\s\S]*?)```/);
  const kandidat = fence ? fence[1] : utanAnsi;
  const start = kandidat.indexOf("{");
  const slut = kandidat.lastIndexOf("}");
  if (start === -1 || slut === -1) throw new Error("Hittade ingen JSON i svaret.");
  return JSON.parse(kandidat.slice(start, slut + 1));
}
