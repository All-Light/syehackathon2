import type { Rapport } from "@/lib/types";

/**
 * The parts of the printed report that have no place on screen: a cover sheet
 * that says what this is and when it was true, and a sources appendix.
 *
 * Both exist because the paper version outlives the tab. A shop owner files
 * this or forwards it to their accountant, and three months later the only
 * questions that matter are "when was this true" and "where did the numbers
 * come from".
 */
export function Framsida({ rapport }: { rapport: Rapport }) {
  const datum = new Date().toLocaleDateString("sv-SE");

  return (
    <header className="endast-tryck tryck-hel" style={{ marginBottom: "10mm" }}>
      <p style={{ fontSize: "8.5pt", letterSpacing: "0.14em", textTransform: "uppercase", color: "#555" }}>
        Competitor review · Sweep
      </p>
      <h1 style={{ fontSize: "26pt", lineHeight: 1.1, margin: "4mm 0 2mm" }}>
        {rapport.egen.namn}
      </h1>
      <p style={{ fontSize: "12pt", lineHeight: 1.35, margin: "0 0 6mm", maxWidth: "150mm" }}>
        {rapport.sammanfattning}
      </p>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "1mm 6mm",
          fontSize: "9pt",
          borderTop: "0.4mm solid #111",
          paddingTop: "3mm",
          margin: 0,
        }}
      >
        <dt style={{ color: "#555" }}>Prepared</dt>
        <dd style={{ margin: 0 }}>{datum}</dd>
        <dt style={{ color: "#555" }}>Subject</dt>
        <dd style={{ margin: 0 }}>{rapport.egen.url}</dd>
        <dt style={{ color: "#555" }}>Competitors read</dt>
        <dd style={{ margin: 0 }}>
          {rapport.konkurrenter.length}
          {rapport.ovriga?.length ? `, plus ${rapport.ovriga.length} named but not read` : ""}
        </dd>
        <dt style={{ color: "#555" }}>Basis</dt>
        <dd style={{ margin: 0 }}>
          The competitors&rsquo; own public pages, and Swedish public company filings
        </dd>
      </dl>
      <p style={{ fontSize: "8.5pt", color: "#555", marginTop: "4mm", maxWidth: "150mm" }}>
        Every price and figure here is quoted from a page listed in the sources at the
        end. Where a claim could not be traced to a source it was left out rather than
        estimated. Public filings lag the present by up to a year and are not audited by
        Bolagsverket.
      </p>
    </header>
  );
}

/** Every distinct page the report drew on, in the order a reader meets them. */
export function Kallor({ rapport }: { rapport: Rapport }) {
  const sedda = new Set<string>();
  const rader: { url: string; vad: string }[] = [];

  const lagg = (url: string | undefined, vad: string) => {
    if (!url || sedda.has(url)) return;
    sedda.add(url);
    rader.push({ url, vad });
  };

  for (const k of rapport.konkurrenter) {
    for (const s of k.sidor) lagg(s.url, `${k.namn} — ${s.typ}`);
    for (const p of k.priser) lagg(p.kalla.url, `${k.namn} — price`);
    lagg(k.orgdata?.kalla?.url, `${k.namn} — public filings`);
    for (const v of k.djup?.vinklar ?? []) {
      for (const f of v.fynd) lagg(f.kalla?.url, `${k.namn} — ${v.rubrik}`);
    }
  }
  for (const i of [...rapport.hot, ...rapport.luckor]) lagg(i.kalla?.url, i.rubrik);

  if (!rader.length) return null;

  return (
    <section className="endast-tryck tryck-ny-sida">
      <h2 style={{ fontSize: "13pt", marginBottom: "3mm" }}>Sources</h2>
      <p style={{ fontSize: "8.5pt", color: "#555", marginBottom: "4mm" }}>
        Read on {new Date().toLocaleDateString("sv-SE")}. Pages change; a claim is only
        as current as the day it was read.
      </p>
      <ol style={{ fontSize: "8.5pt", lineHeight: 1.5, paddingLeft: "7mm", margin: 0, listStyle: "decimal" }}>
        {rader.map((r) => (
          <li key={r.url} style={{ marginBottom: "1.5mm" }}>
            <span style={{ color: "#555" }}>{r.vad}. </span>
            <span style={{ wordBreak: "break-all" }}>{r.url}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
