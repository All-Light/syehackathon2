import type { Metadata } from "next";
import Fot from "@/components/Fot";

export const metadata: Metadata = {
  title: "Privacy — Sweep",
  description:
    "What Sweep stores, who it sends data to, and how long it keeps it. Written from the code, in plain words.",
};

/** The date this text was last checked against the code. */
const UPPDATERAD = "29 August 2026";

/**
 * A section: serif heading, then whatever the section says. The same rhythm as
 * the report — heading, then prose the width of a reading column.
 */
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

/** The small-caps label that separates one part of a section from the next. */
function Etikett({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] uppercase tracking-[0.16em] text-dampad">{children}</h3>
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

function Lank({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-amber underline-offset-4 hover:underline"
    >
      {children}
    </a>
  );
}

export default function Integritet() {
  return (
    <div className="flex min-h-dvh flex-col bg-papper">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-5">
          <span className="text-[11px] uppercase tracking-[0.16em] text-dampad">
            Sweep
          </span>
          <h1 className="font-serif text-5xl leading-[1.08] text-black">Privacy</h1>
          <P>
            This page describes what Sweep actually does with data. It was written by
            reading the code, not by copying a template, and it says{" "}
            <em className="not-italic text-black">we have not decided that yet</em> where
            that is the honest answer.
          </P>
          <P>
            It is a plain-language description, not legal advice, and no lawyer has
            reviewed it. Last checked against the code on {UPPDATERAD}.
          </P>
        </header>

        <Avsnitt rubrik="The short version">
          <Punkter>
            <li>
              You paste a web address. We read that site and the sites of the competitors
              we find, send the text of those pages to a language model to make sense of
              them, and save the result as a report.
            </li>
            <li>
              <span className="text-black">
                A report is readable by anyone who has its link.
              </span>{" "}
              There is no password on it. That is deliberate, and it is the most important
              thing on this page.
            </li>
            <li>
              You need no account. If you want one, you can sign in with Google — and note
              that while you are signed in, any report you open that has no owner yet is
              recorded as yours.
            </li>
            <li>
              We send content to several other companies — that is what the product is
              made of. They are all listed below.
            </li>
          </Punkter>
        </Avsnitt>

        <Avsnitt rubrik="What we store">
          <Etikett>The analysis</Etikett>
          <Punkter>
            <li>The web address you typed in, and the company name we worked out from it.</li>
            <li>
              The finished report in full: what we found about you and about each
              competitor, including quotes from the pages we read and links back to them.
            </li>
            <li>
              While a run is in progress, its status and the lines you see in the working
              view, so the link keeps working if you reload or lose signal.
            </li>
            <li>
              Each change we detect on a report&rsquo;s change feed — whether from a check
              you run or from history backfilled out of the Internet Archive: the
              competitor, the page, what changed, when we noticed, and a link to the source
              we saw it in.
            </li>
          </Punkter>

          <Etikett>An email address, if you type one in</Etikett>
          <P>
            A report can have one address attached to it. It is stored on that report and
            nothing is sent to it: this product has no mail provider configured and no code
            in it sends mail. Two things are worth knowing. The address is shown back on
            that report&rsquo;s monitoring page, so anyone holding the report link can read
            it. And a second address typed on the same report replaces the first — the link
            is the only identity we have, so we cannot tell the owner correcting a typo
            from a stranger.
          </P>

          <Etikett>If you sign in</Etikett>
          <P>
            Sign-in is Google through Supabase Auth. We hold the account id and the email
            address Google gives us, and that is all an account is for: telling us which
            reports are yours. Ownership is taken automatically — opening a report that has
            no owner while you are signed in records it as yours, including a report someone
            else made and sent you the link to. A report that already has an owner is never
            reassigned. Delete the account and the reports keep working; they simply go back
            to being unowned.
          </P>

          <Etikett>If you pay</Etikett>
          <P>
            Payment runs in Stripe&rsquo;s hosted checkout. We never see your card number.
            We store a paid flag on the report, and we hand Stripe the report id and the
            plan name so a payment can be matched back to the report. Stripe keeps its own
            record of the payment under its own terms.
          </P>

          <Etikett>Automatically</Etikett>
          <Punkter>
            <li>
              Vercel, our host, keeps server logs of requests. Our own code writes lines to
              that same log: how long each stage took, how large a prompt and its answer
              were, and errors.
            </li>
            <li>
              Vercel Analytics and Speed Insights run on every page. They count page views
              and measure how quickly pages load. We do not use them to build a profile of
              you and there is no advertising on this site.
            </li>
          </Punkter>
        </Avsnitt>

        <Avsnitt rubrik="What stays in your browser">
          <P>
            Your browser keeps a list of the last eight reports it has opened, under the
            key <span className="text-black">sweep.tidigare.v1</span> in local storage: the
            report id, the address you typed, the company name and a timestamp. It is what
            fills the &ldquo;Previous research&rdquo; list on the front page. It never
            reaches our server, and clearing your site data clears it.
          </P>
          <P>
            Cookies are only for sign-in. Signing in sets Supabase session cookies (their
            names start with <span className="text-black">sb-</span>), plus one short-lived
            cookie while a Google sign-in is in flight; a small piece of middleware
            refreshes them so you are not signed out every hour. If you never sign in,
            Sweep sets no cookies of its own.
          </P>
        </Avsnitt>

        <Avsnitt rubrik="Who we send data to">
          <P>
            We do not sell data and we run no advertising. We cannot tell you we keep
            everything to ourselves, though, because reading the web on your behalf means
            handing content to the companies that do the reading:
          </P>
          <dl className="flex flex-col gap-3 text-[15px] leading-relaxed">
            <div>
              <dt className="text-black">
                <Lank href="https://opencode.ai">OpenCode Zen</Lank> — language model
              </dt>
              <dd className="text-dampad">
                The largest transfer by far: the text of the pages we read, together with
                our instructions, so the model can pull out prices, positioning and
                weaknesses. Used for every run.
              </dd>
            </div>
            <div>
              <dt className="text-black">
                <Lank href="https://www.anthropic.com">Anthropic</Lank> — language model
              </dt>
              <dd className="text-dampad">
                The same kind of text, for the parts of a report that are written rather
                than extracted. Used only when the deployment has an Anthropic key
                configured; without one, everything goes to OpenCode Zen.
              </dd>
            </div>
            <div>
              <dt className="text-black">
                <Lank href="https://firecrawl.dev">Firecrawl</Lank> — scraping and search
              </dt>
              <dd className="text-dampad">
                The addresses we want fetched and the search queries we want run. It
                fetches the pages for us.
              </dd>
            </div>
            <div>
              <dt className="text-black">
                <Lank href="https://exa.ai">Exa</Lank> — search
              </dt>
              <dd className="text-dampad">
                Search queries, and the address of a page when we ask for others like it.
              </dd>
            </div>
            <div>
              <dt className="text-black">
                <Lank href="https://archive.org">Internet Archive</Lank> — page history
              </dt>
              <dd className="text-dampad">
                The addresses whose past versions we want to look at. Requested straight
                from our server, identifying itself as Sweep.
              </dd>
            </div>
            <div>
              <dt className="text-black">
                <Lank href="https://www.allabolag.se">allabolag.se</Lank> and similar
                registers — company filings
              </dt>
              <dd className="text-dampad">
                Read through Firecrawl, along with bolagsfakta.se, ratsit.se and proff.se.
                We look up public Swedish accounts: revenue, profit, employees.
              </dd>
            </div>
            <div>
              <dt className="text-black">
                <Lank href="https://supabase.com">Supabase</Lank> — database and sign-in
              </dt>
              <dd className="text-dampad">
                Where reports, runs, detected changes, any attached email address and any
                account live.
              </dd>
            </div>
            <div>
              <dt className="text-black">
                <Lank href="https://vercel.com">Vercel</Lank> — hosting
              </dt>
              <dd className="text-dampad">
                Serves every page, keeps the server logs, and provides the page-view and
                speed measurements.
              </dd>
            </div>
            <div>
              <dt className="text-black">
                <Lank href="https://stripe.com">Stripe</Lank> — payments
              </dt>
              <dd className="text-dampad">
                Only if you buy something. Stripe collects the card and billing details
                directly; we get back the fact that the report was paid for.
              </dd>
            </div>
            <div>
              <dt className="text-black">Google — sign-in</dt>
              <dd className="text-dampad">
                Only if you choose to sign in with Google. Google tells us your account id
                and email address; we never see your password.
              </dd>
            </div>
            <div>
              <dt className="text-black">
                <Lank href="https://elevenlabs.io">ElevenLabs</Lank> — text to speech
              </dt>
              <dd className="text-dampad">
                Only when you press Listen. We send the short spoken briefing — under a
                thousand characters of it — and get audio back.
              </dd>
            </div>
          </dl>
          <P>
            Most of these are US companies, so report content is processed outside the
            EU/EEA.
          </P>
          <Lucka>
            To be filled in by the owner: which of the providers above we have a data
            processing agreement with, and on what basis data is transferred out of the
            EU/EEA. Nothing on this page should be read as saying that question is settled.
          </Lucka>
        </Avsnitt>

        <Avsnitt rubrik="What we read about other companies">
          <Punkter>
            <li>
              Public web pages — the same ones you could open yourself: home pages, pricing
              pages, product pages, news articles, review sites.
            </li>
            <li>
              Public Swedish company filings from allabolag.se and similar registers.
            </li>
            <li>Older versions of those pages held by the Internet Archive.</li>
          </Punkter>
          <P>
            We do not log in anywhere, we do not buy data sets, and we do not read anything
            behind a paywall or a login. Nearly all of it is information about companies
            rather than people — but a public page can carry a founder&rsquo;s name, a
            quote with a name on it, or a review somebody wrote, and that text can end up
            in a report and in a prompt to the language model. If you are a person named in
            a Sweep report and you want it removed, write to us and we will remove it.
          </P>
        </Avsnitt>

        <Avsnitt rubrik="Why we are allowed to hold it">
          <Punkter>
            <li>
              <span className="text-black">Running the analysis and storing the report</span>{" "}
              — to do the thing you asked for. Contract, GDPR Article 6(1)(b).
            </li>
            <li>
              <span className="text-black">An email address you type in</span> — because you
              chose to give it. Consent, which you can withdraw by asking us to remove it.
            </li>
            <li>
              <span className="text-black">Your account, if you sign in</span> — contract.
            </li>
            <li>
              <span className="text-black">Payments and the records behind them</span> —
              contract, and Swedish bookkeeping law for the records.
            </li>
            <li>
              <span className="text-black">Server logs and page counts</span> — legitimate
              interest: keeping the site up and knowing whether anyone is using it.
            </li>
            <li>
              <span className="text-black">Reading public pages about companies</span> —
              legitimate interest: market research about businesses.
            </li>
          </Punkter>
        </Avsnitt>

        <Avsnitt rubrik="How long we keep it">
          <P>
            We have not set a retention period. Reports, runs and change records are kept
            for as long as the service exists; nothing deletes them on a schedule, because
            no schedule has been written. That is a gap rather than a policy, and stating it
            plainly is better than inventing a number we do not honour.
          </P>
          <P>
            What we can say: ask us to delete a report and we will delete it, and its
            change records go with it. Your browser&rsquo;s own list clears when you clear
            site data. Stripe, Supabase, Vercel and the other providers keep their own
            records for their own periods, under their own terms.
          </P>
        </Avsnitt>

        <Avsnitt rubrik="Reports are public to anyone with the link">
          <P>
            This is a design choice, not an oversight: a report is meant to be shared with a
            colleague or an accountant without either of them signing up for anything.
          </P>
          <P>
            What it means in practice. A report address contains a random identifier that is
            not practically guessable, and we publish no list of reports anywhere — but that
            identifier is the only thing protecting it. Anyone you send the link to can read
            the report and forward it. If the link is posted somewhere public, a search
            engine can find and index it. Everything attached to the report travels with the
            link, including an email address left on it. Treat a report link the way you
            would treat a shared document link.
          </P>
        </Avsnitt>

        <Avsnitt rubrik="Security, honestly">
          <Punkter>
            <li>Everything is served over HTTPS.</li>
            <li>
              The database tables have row-level security switched on with no public
              policies, so no browser can read them directly. Only our server can, using a
              secret key that never leaves it.
            </li>
            <li>Sign-in is handled by Supabase and Google. We never see your password.</li>
            <li>
              We hold no security certification, we have commissioned no external audit, and
              we have no formal breach-notification process written down. What protects a
              report is the unguessable link, and nothing else.
            </li>
          </Punkter>
        </Avsnitt>

        <Avsnitt rubrik="Your rights">
          <P>
            Under GDPR you can ask for a copy of the personal data we hold about you, ask us
            to correct it, ask us to delete it, ask us to restrict or stop processing it,
            object to processing we base on legitimate interest, ask for it in a portable
            form, and withdraw consent you have given.
          </P>
          <P>
            There is no self-service delete button in the product yet, so these requests are
            handled by hand: write to us and we will do it. You also have the right to
            complain to the Swedish authority,{" "}
            <Lank href="https://www.imy.se">
              Integritetsskyddsmyndigheten (IMY)
            </Lank>
            .
          </P>
        </Avsnitt>

        <Avsnitt rubrik="Who we are">
          <Lucka>
            To be filled in by the owner before this page goes in front of customers: the
            legal entity responsible for Sweep, its Swedish organisation number, its postal
            address, and an email address for privacy requests. Sweep was built at a
            hackathon and none of these have been entered yet — so the requests described
            above currently have nowhere to go.
          </Lucka>
        </Avsnitt>

        <Avsnitt rubrik="Changes to this page">
          <P>
            The product is early and moves quickly. When what it does changes, this page is
            meant to change with it — the date under the heading is how you tell which
            version you are reading.
          </P>
        </Avsnitt>
      </main>
      <Fot className="mt-auto" />
    </div>
  );
}
