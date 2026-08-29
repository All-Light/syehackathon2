/** No claim ships without one of these. A number without a source is dropped. */
export type Kalla = { url: string; citat: string };

export type Prisniva = {
  namn: string;
  pris: string;
  period: string | null;
  kalla: Kalla;
};

/** From the Swedish company register. The thing no US competitor tool can say. */
export type Orgdata = {
  orgnr: string | null;
  omsattningTkr: number | null;
  resultatTkr: number | null;
  anstallda: number | null;
  tillvaxtProcent: number | null;
  ar: number | null;
  kalla: Kalla | null;
};

export type SidTyp = "pris" | "produkt" | "om" | "nyheter" | "annat";

/** The monitoring baseline: exactly which pages we read, and what they said. */
export type BevakadSida = {
  url: string;
  typ: SidTyp;
  hash: string;
  hamtad: string;
};

/** One research angle's findings, each tied to where it came from. */
export type Fynd = { text: string; kalla: Kalla | null };

export type VinkelId = "affarsmodell" | "produkt" | "malgrupp" | "rykte" | "bolag";

export type Vinkel = {
  id: VinkelId;
  rubrik: string;
  fynd: Fynd[];
};

/**
 * A deep dive on one competitor: several researchers working different angles
 * in parallel, then one writer turning what they found into a picture of how
 * that company actually makes money and where it beats or loses to us.
 */
export type Djupdykning = {
  skapad: string;
  sammanfattning: string;
  affarsmodell: string;
  intaktsmodell: string;
  /** Where they are ahead of us, and where we are ahead of them. */
  battre: Insikt[];
  samre: Insikt[];
  taktik: string[];
  vinklar: Vinkel[];
  /** Which model wrote it, so the report can say. */
  skrivenAv: string;
};

export type Konkurrent = {
  namn: string;
  url: string;
  hittadAv: "du" | "agenten";
  varfor: string;
  positionering: string;
  malgrupp: string;
  priser: Prisniva[];
  funktioner: string[];
  styrkor: string[];
  svagheter: string[];
  orgdata: Orgdata | null;
  sidor: BevakadSida[];
  /** Absent until someone asks for the deep dive — it costs real research. */
  djup?: Djupdykning | null;
};

export type Foretag = {
  namn: string;
  url: string;
  vadNiSaljer: string;
  malgrupp: string;
  prismodell: string;
  sprak: string;
  geografi: string;
  /** Feeds the search queries in the discovery step. */
  nyckelord: string[];
};

export type Insikt = {
  rubrik: string;
  text: string;
  konkurrent: string | null;
  kalla: Kalla | null;
};

/**
 * A competitor we have named but not yet read. Discovery is cheap and finding
 * fifteen is nearly the same cost as finding five; reading one costs a map, two
 * scrapes and an LLM call. So we name everything and deep-read the top few.
 */
export type Namngiven = {
  namn: string;
  url: string;
  varfor: string;
  hittadAv: "du" | "agenten";
};

export type Rapport = {
  sammanfattning: string;
  egen: Foretag;
  konkurrenter: Konkurrent[];
  /** Named, ranked, not read. The user can promote any of these. */
  ovriga: Namngiven[];
  hot: Insikt[];
  luckor: Insikt[];
  atgarder: string[];
  /** Absent until bought. */
  full?: Fullrapport | null;
};

/** What the working view sees, streamed over SSE as the agent runs. */
export type Handelse =
  /** First frame of every run: the id its URL will live at. */
  | { typ: "korning"; id: string }
  | { typ: "steg"; steg: string; text: string }
  | { typ: "kandidat"; namn: string; url: string }
  | { typ: "konkurrent"; konkurrent: Konkurrent }
  | { typ: "profil"; egen: Foretag }
  | { typ: "klar"; rapport: Rapport; id: string | null }
  | { typ: "fel"; text: string };

/**
 * How far a claim is from the page it came from. Three labels, each with a
 * mechanical rule, because a number would imply a precision we do not have.
 */
export type Tillit =
  | "verifierat" // quoted from a page we fetched, or a public filing
  | "harlett" // follows from two or more verified facts
  | "bedomning"; // our reading; a reasonable person could disagree

/** One argument in the full report. The heading states the conclusion. */
export type Avsnitt = {
  rubrik: string;
  brodtext: string;
  tillit: Tillit;
  kallor: Kalla[];
};

/** Where each competitor sits on price against breadth — computed, not written. */
export type Position = {
  konkurrent: string;
  prisPerManad: number | null;
  bredd: number;
  omsattningTkr: number | null;
};

/**
 * The paid tier. Structured the way a strategy deliverable is: the governing
 * answer first, then the arguments that hold it up, then the evidence — rather
 * than a list of observations in the order we happened to find them.
 */
export type Fullrapport = {
  skapad: string;
  skrivenAv: string;
  /** The one sentence the whole report exists to support. */
  slutsats: string;
  ogonblick: string[];
  avsnitt: Avsnitt[];
  positioner: Position[];
  /** Why these competitors and not others — so the selection is checkable. */
  urval: string;
  metod: string;
};

/** Streamed while the full report is written. */
export type FullHandelse =
  | { typ: "steg"; text: string }
  | { typ: "avsnitt"; avsnitt: Avsnitt }
  | { typ: "klar"; full: Fullrapport }
  | { typ: "fel"; text: string };

/** Streamed while the deep-dive researchers work. */
export type DjupHandelse =
  | { typ: "steg"; text: string }
  | { typ: "vinkel"; vinkel: Vinkel }
  | { typ: "klar"; djup: Djupdykning }
  | { typ: "fel"; text: string };

/** A monitoring run: what changed on the pages we baselined. */
export type Forandring = {
  konkurrent: string;
  url: string;
  typ: SidTyp;
  vad: string;
  upptackt: string;
};
