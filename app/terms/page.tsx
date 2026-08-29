import type { Metadata } from "next";
import Link from "next/link";
import Fot from "@/components/Fot";
import { ORDINARIE_RAPPORT, PRISER, kopAktivt } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Terms — Sweep",
  description:
    "What Sweep does, where its information comes from, what it costs, and what it does not promise.",
};

/** The date this text was last checked against the code. */
const UPPDATERAD = "29 August 2026";

/** Öre to kronor, grouped the Swedish way: 100 000 öre reads as 1 000 kr. */
const kr = (öre: number) => (öre / 100).toLocaleString("sv-SE");

function Avsnitt({
  rubrik,
  children,
}: {
  rubrik: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-linje pt-8">
      <h2 className="font-serif text-2xl text-black">{rubrik}</h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-relaxed text-dampad">{children}</p>;
}

function Punkter({ children }: { children: React.ReactNode }) {
  return (
    <ul className="flex flex-col gap-2 text-[15px] leading-relaxed text-dampad">
      {children}
    </ul>
  );
}

/** A gap the owner has to close before this page is finished. Loud on purpose. */
function Lucka({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-amber pl-3 text-[15px] leading-relaxed text-amber">
      {children}
    </p>
  );
}

export default function Villkor() {
  const oppet = kopAktivt();
  // Read on the server and rendered as a sentence, never as a value: a page that
  // claims "test mode" should be reading the key it is talking about, so the
  // claim cannot quietly outlive the deployment that made it true.
  const testlage = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test");

  return (
    <div className="flex min-h-dvh flex-col bg-papper">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-5">
          <span className="text-[11px] uppercase tracking-[0.16em] text-dampad">
            Sweep
          </span>
          <h1 className="font-serif text-5xl leading-[1.08] text-black">Terms</h1>
          <P>
            The deal, in plain words: what Sweep does, where its information comes from,
            what it costs and what it does not promise. This is a description written by
            the people who built it, not legal advice, and no lawyer has reviewed it. Last
            checked against the code on {UPPDATERAD}.
          </P>
        </header>

        <Avsnitt rubrik="What Sweep does">
          <P>
            You paste your web address. Sweep reads your site, works out who you compete
            with, reads their public pages, and writes up what they charge, what they
            promise, where they are weak and what has been filed about them. The summary is
            free. The full written report is the paid part. Monitoring re-reads those pages
            later and lists what has moved.
          </P>
          <P>
            Monitoring checks run when a report&rsquo;s monitoring page asks for one —
            there is no scheduled background check yet, and nothing is emailed to you.
          </P>
        </Avsnitt>

        <Avsnitt rubrik="It is written by software, and it can be wrong">
          <P>
            Every report is produced automatically. A language model reads the pages and
            pulls the facts out of them, and it makes the kind of mistakes that come with
            that: a price read from the wrong tier, a company confused with a
            similarly-named one, a filing attributed to the wrong business, a competitor
            that is not really a competitor, or a page that has changed since we read it.
          </P>
          <P>
            That is why nearly every claim in a report carries the source it came from.{" "}
            <span className="text-black">
              Check the source before you act on anything that matters.
            </span>{" "}
            Sweep is research, not advice — not legal, financial, tax or investment advice —
            and the decisions you make from it are yours.
          </P>
        </Avsnitt>

        <Avsnitt rubrik="A report link is public">
          <P>
            A report has no password. Anyone holding its link can read it, and can pass it
            on. The address contains a random identifier that is not practically guessable
            and we publish no index of reports, but that is the only thing protecting it —
            and a link posted somewhere public can be found by a search engine. Share a
            report link the way you would share a document link, and expect anything you
            attach to the report, such as an email address, to travel with it.
          </P>
        </Avsnitt>

        <Avsnitt rubrik="Where the information comes from">
          <P>
            Public web pages, public Swedish company filings from allabolag.se and similar
            registers, and older versions of those pages held by the Internet Archive.
            Nothing behind a login or a paywall; we do not log in anywhere and we buy no
            data sets. Everything a competitor section says about a company was published
            by somebody, and the report tells you where.
          </P>
          <P>
            Those pages belong to whoever wrote them. A report quotes and links them so its
            claims can be checked; it is not a licence for you to republish their content
            as your own.
          </P>
        </Avsnitt>

        <Avsnitt rubrik="What it costs">
          <Punkter>
            <li>
              <span className="text-black">A full report — {kr(ORDINARIE_RAPPORT)} kr.</span>{" "}
              One payment, for one report. The early-bird price while the offer runs is{" "}
              {kr(PRISER.rapport.belopp)} kr.
            </li>
            <li>
              <span className="text-black">
                Monitoring — {kr(PRISER.bevakning.belopp)} kr per month.
              </span>{" "}
              A subscription that runs until it is cancelled.
            </li>
          </Punkter>
          <P>
            Prices are in Swedish kronor. Payment goes through Stripe&rsquo;s hosted
            checkout; we never see your card details.
          </P>
          {oppet ? null : (
            <P>
              <span className="text-black">Sales are switched off right now.</span> The buy
              buttons are disabled and the checkout endpoint refuses, so nothing can be
              bought here today.
              {testlage
                ? " Stripe is also running in test mode on this deployment, which means no card could be charged even if it were switched on."
                : null}
            </P>
          )}
          <Lucka>
            To be filled in by the owner before sales are switched on: whether the prices
            above include VAT, how a monitoring subscription is cancelled, and what the
            refund and right-of-withdrawal terms are.
          </Lucka>
        </Avsnitt>

        <Avsnitt rubrik="No warranty">
          <P>
            Sweep is provided as it is. We do not promise that it will be available, that a
            run will finish, that a report is accurate or complete, or that it will find
            every competitor you have. It is an early product built at a hackathon: it can
            change, and it can stop working, without notice.
          </P>
          <P>
            To the extent the law allows, we are not liable for losses arising from using
            Sweep or from relying on a report. Nothing here takes away rights you have
            under mandatory law.
          </P>
        </Avsnitt>

        <Avsnitt rubrik="Using it fairly">
          <Punkter>
            <li>Use it to research your own market.</li>
            <li>
              Do not try to break it, overload it, or work around the parts that are paid
              for.
            </li>
            <li>
              Do not use it to gather information about a private individual. It is a tool
              for looking at companies.
            </li>
          </Punkter>
          <P>
            We may stop serving an analysis, or remove a report, if it is being used
            against these lines.
          </P>
        </Avsnitt>

        <Avsnitt rubrik="Your data">
          <P>
            What Sweep stores, who it sends content to and how long it keeps it is set out
            on the{" "}
            <Link href="/privacy" className="text-amber underline-offset-4 hover:underline">
              privacy page
            </Link>
            , which is part of these terms.
          </P>
        </Avsnitt>

        <Avsnitt rubrik="Law and contact">
          <P>Swedish law applies to these terms.</P>
          <Lucka>
            To be filled in by the owner: the legal entity behind Sweep, its Swedish
            organisation number, its postal address, and an email address to reach it at.
            None of these have been entered yet.
          </Lucka>
        </Avsnitt>
      </main>
      <Fot className="mt-auto" />
    </div>
  );
}
