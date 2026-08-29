import type { Metadata, Viewport } from "next";
import { Geist_Mono, Instrument_Serif, Inter, Inter_Tight } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Temavaljare, { type Tema } from "@/components/Temavaljare";
import "./globals.css";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});

const ui = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-ui",
  display: "swap",
});

/** The console's display face: one grotesk, cut tight, semibold at −0.02em. */
const tight = Inter_Tight({
  subsets: ["latin", "latin-ext"],
  variable: "--font-tight",
  display: "swap",
});

/** Every number on the dashboard — index, count, year, amount — is set in it. */
const siffra = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-siffra",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sweep — keep tabs on your competitors",
  description:
    "Paste your website. Ninety seconds later you know what your competitors charge, what they promise and where they are weak.",
};

export const viewport: Viewport = {
  themeColor: "#141519",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Which of the two worlds this request renders in.
 *
 * A cookie rather than localStorage, and the reason is the first paint. The
 * theme decides the ground colour of every surface on the page, so if the
 * client picks it there is either a flash of the wrong world or a blocking
 * script in the head to prevent one — and either way the server has emitted
 * markup it cannot know is right. A cookie is on the request, so the server
 * decides, writes `data-tema` into the HTML it sends, and hydration has
 * nothing to disagree about: the attribute React renders is the attribute
 * already in the DOM.
 *
 * The read is behind a build-time constant, so production never calls a
 * dynamic API and every page that was static stays static. The switch is a
 * comparison tool for the owner, not a product feature.
 */
async function laesTema(): Promise<Tema> {
  if (process.env.NODE_ENV === "production") return "natt";
  const { cookies } = await import("next/headers");
  const kakor = await cookies();
  return kakor.get("tema")?.value === "papper" ? "papper" : "natt";
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tema = await laesTema();

  return (
    <html
      lang="en"
      data-tema={tema}
      className={`${display.variable} ${ui.variable} ${tight.variable} ${siffra.variable}`}
    >
      <body>
        {children}
        <Temavaljare tema={tema} />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
