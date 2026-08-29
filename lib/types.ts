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

export type Rapport = {
  sammanfattning: string;
  egen: Foretag;
  konkurrenter: Konkurrent[];
  hot: Insikt[];
  luckor: Insikt[];
  atgarder: string[];
};

/** What the working view sees, streamed over SSE as the agent runs. */
export type Handelse =
  | { typ: "steg"; steg: string; text: string }
  | { typ: "kandidat"; namn: string; url: string }
  | { typ: "konkurrent"; konkurrent: Konkurrent }
  | { typ: "profil"; egen: Foretag }
  | { typ: "klar"; rapport: Rapport; id: string | null }
  | { typ: "fel"; text: string };

/** A monitoring run: what changed on the pages we baselined. */
export type Forandring = {
  konkurrent: string;
  url: string;
  typ: SidTyp;
  vad: string;
  upptackt: string;
};
