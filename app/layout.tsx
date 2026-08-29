import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
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

export const metadata: Metadata = {
  title: "Koll — ha koll på dina konkurrenter",
  description:
    "Klistra in din webbplats. Nittio sekunder senare vet du vad dina konkurrenter tar betalt, vad de lovar och var de är svaga.",
};

export const viewport: Viewport = {
  themeColor: "#faf8f5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv" className={`${display.variable} ${ui.variable}`}>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
