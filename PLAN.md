# Koll — an agent that keeps tabs on your competitors

> Working name: **Koll** (Swedish: "ha koll på" — to keep tabs on). Same naming logic as
> Lugn: one short Swedish word that *is* the job to be done. Alternates: Spana, Överblick.

## Context

Pivot from Lugn (voice de-escalation training) at ~11:30 Saturday. SweYoung Hackpack,
CMNTY Stockholm. **Final submission Sunday 10:00 sharp.** Roughly **22 hours** remain.
Team of 4: 2 technical, 2 non-technical.

**Track: AI Agents.** Traction 12 / Problem & validation 14 / Business potential 16 /
Originality 8 = 50.

Read the weights literally. *Problem & validation* (14) and *business potential* (16) are
30 of the 50 points and neither requires a single line of code. The 14-point line reads
"painful, frequent and validated problem **where an AI agent is clearly the right
solution**" — so the pitch has to prove not just the pain but that an agent, specifically,
is the right tool. Traction is only 12 here, and 2+ paying customers maxes it. That is
reachable today.

**Customer:** primarily one Swedish SMB as design partner, with startup founders as the
second segment. Both feel the same pain; the SMB pays for peace of mind, the founder pays
for speed.

---

## The product, in one sentence

You paste your website. Ninety seconds later you have a sourced, structured teardown of
the five competitors you actually have — including the two you had not heard of — with
every claim linked to the sentence on their site that it came from.

## Why an agent is genuinely the right tool (the 14-point argument)

Competitor analysis is not one question. It is an unbounded loop of *search → decide what
is worth reading → read it → decide what that means → search again*. That is exactly the
shape of work an agent does and a chat box does not:

1. **Discovery.** You do not know who your competitors are. The agent generates search
   queries in Swedish and English, reads results, and proposes competitors you never named.
   A chat wrapper can only compare the names you already typed.
2. **Navigation.** Pricing lives at a different URL on every site. The agent maps each
   site and *chooses* which pages are worth the scrape.
3. **Judgment under variance.** Twelve candidates come back; five matter. The agent ranks
   and discards.
4. **Repetition.** The same loop, re-run weekly, becomes monitoring. The agent is the
   only part that scales.

Say this plainly in the pitch and demo the discovery step live — the moment it surfaces a
competitor the founder did not know about is the moment the judges believe it.

## The moat: Swedish public company data

Every incumbent (Crayon, Klue, Kompyte, ChatGPT deep research) reads marketing pages. In
Sweden, competitors publish their **annual accounts**. `allabolag.se` gives revenue,
profit, employee count and growth for any Swedish AB by org number.

So our report says something no US tool can say:

> "Konkurrent AB omsatte 4,2 Mkr förra året, upp 31 %, med 6 anställda. De tar 20 % mer än
> du för samma tjänst."

That is the originality line (8p) and it is genuinely hard to copy from Palo Alto. Verify
the exact source and its terms before the pitch; do not cite numbers from memory.

---

## Screens

Three. No login, no dashboard, no settings.

1. **Start** — one field ("din webbplats"), one button *Analysera*. An optional
   "jag vet redan om dessa" chip input. 10 seconds to value.
2. **Arbetsvy** — the agent working, streamed live. `Läser din sajt… Hittade 12 möjliga
   konkurrenter… Läser Konkurrent A:s prissida…`. Reuse the Lugn orb. **This screen is the
   demo video** — the wait is not dead time, it is the proof that real work is happening.
   Target 90–120s.
3. **Rapport** — comparison table, where you are cheaper and where you are not, gaps to
   attack, three concrete actions this week, every claim with a source link and quoted
   snippet. Buttons: *Bevaka*, *Lyssna*, *Dela*.

Mobile portrait is primary. The sellers demo it standing in a shop.

---

## Architecture

### Pipeline, not free-form loop

Genuinely agentic where it matters (it decides who to research and which pages to read),
but a **typed pipeline with parallel sub-agents**, not an open ReAct loop. Reason: 22
hours, and free-form loops are demo-fragile. Be honest about this in the pitch; nobody is
scored on ReAct.

```
1. profileSelf(url)          → what you sell, to whom, at what price, in what language
2. discoverCompetitors()     → parallel Firecrawl search, SV + EN queries, dedupe, rank → 5
3. researchCompetitor(×5)    → map site → choose pricing/product/about/news pages → scrape
                               → extract to schema → allabolag.se if Swedish AB
4. synthesise()              → comparison, threats, gaps, 3 actions. Citations mandatory.
5. persist()                 → Supabase, share link /r/[id]
6. watch()                   → store page set + content hashes for the diff
```

Every step streams a line to the Arbetsvy over SSE.

### Stack

- **Next.js 16 + TypeScript + Tailwind 4**, Vercel. Scaffold already carried over and builds.
- **Firecrawl HTTP API** from route handlers — `search`, `map`, `scrape`, `extract`. Not
  the CLI; Vercel cannot shell out. Needs `FIRECRAWL_API_KEY` in `.env` (**missing — get
  this first**).
- **LLM: `lib/llm/zen.ts`**, carried over. deepseek-v4-flash via OpenCode Zen,
  `reasoning_effort: "minimal"`, swappable to any OpenAI-shaped endpoint via
  `GRADER_PROVIDER=openai-compatible`. `plockaJson` already handles fenced JSON.
- **Supabase**, existing project, one new table (`rapporter` belongs to Lugn — leave it).
- **Zod** schemas on every extraction. An unparseable competitor is dropped, not guessed.

### Data model

```ts
type Rapport = {
  id: string;
  egen: Foretag;                  // the user's own company profile
  konkurrenter: Konkurrent[];
  jamforelse: Rad[];              // dimension × company matrix
  hot: Insikt[];                  // where they beat you
  luckor: Insikt[];               // where you can attack
  atgarder: string[];             // 3 things to do this week
  bevakas: boolean;
};

type Konkurrent = {
  namn: string; url: string;
  hittadAv: "du" | "agenten";     // surface this in the UI — it is the wow moment
  positionering: string;
  priser: { namn: string; pris: string; kalla: Kalla }[];
  funktioner: string[];
  orgdata: { omsattning?: number; anstallda?: number; tillvaxt?: number } | null;
  sidor: { url: string; hash: string }[];   // the monitoring baseline
};

type Kalla = { url: string; citat: string };  // no claim ships without one
```

### Monitoring, without waiting a day for it

The one-shot stores the exact page set and a content hash per page. *Bevaka* flips a flag;
a diff endpoint re-scrapes and reports what changed. For the demo, a **"kör kontroll nu"**
button proves the loop is real in five seconds — no cron has to have been running
overnight for the judges to believe it. Nightly cron is a one-liner on Vercel afterwards.

### ElevenLabs (prize category, open to every track)

After the report renders: *Lyssna* — a 60-second spoken Swedish briefing of the findings.
TTS, not a conversational agent. Cheap, uses the existing key, qualifies for
"Best build with ElevenLabs" (8 970 kr/member). Stretch, only if everything else is done:
a conversational agent you can interrupt to ask "varför är X billigare?".

### Stripe

**Do not build billing.** A Stripe Payment Link, a webhook that flips a boolean on a row.
Pricing: **490 kr** per report, or **290 kr/mån** for bevakning. Twenty minutes of work
that converts directly into rubric points.

---

## Timeline (Saturday 12:00 → Sunday 10:00)

| When | Build (2 people) | Sell (2 people) |
|---|---|---|
| 12:00 | Name the design-partner SMB. `FIRECRAWL_API_KEY` into `.env`. `git init`. | Build the Saturday route list; shops close ~18:00 |
| 12:30 | Routes, SSE plumbing, Firecrawl client, `profileSelf` end to end | Start walking. Sell the problem, not the demo |
| 14:00 | Discovery + per-competitor research, cited extraction | |
| **16:00** | **Hard milestone: one real report on the design partner's real competitors, on a phone** | Switch to demoing it live |
| 17:00 | Report UI — the screen judges see. Synthesis quality pass | |
| 19:00 | Supabase persist + share links | Demo with live links; leave a link behind at every visit |
| 20:00 | Bevakning: hashes, diff endpoint, "kör kontroll nu" | Founders in the room are segment two — sell to them |
| 21:30 | Stripe payment link + paid flag | **Close. Target 2+ paying customers** |
| 22:30 | Milestone 3 check-in form (23:00 deadline) | |
| 23:00 | ElevenLabs voice briefing | Draft submission text |
| 00:30 | Polish: mobile portrait, error states, empty states | |
| 02:00 | Demo video + submission + 3-min pitch deck | |
| 04:00 | Sleep in shifts | |
| 08:00 | Dress rehearsal on venue wifi, cached report ready | |
| **09:00** | **Submit — a full hour early. Late does not count.** | |

## Risks

- **Firecrawl credits/rate limits.** Check the plan ceiling in the first 30 minutes. Cache
  every scrape into Supabase and always have a cached run to demo from.
- **Latency.** Five competitors × several pages each. Parallelise, cap pages per site,
  and make the wait watchable rather than shorter.
- **Hallucinated pricing.** Any claim without a `Kalla` is dropped before render. A wrong
  price in front of a shop owner ends the sale.
- **Venue wifi.** Pre-record the demo video. Have a report already loaded.
- **Scope.** Voice and monitoring are both cuttable. The one-shot report is not.

## Open question

**Which Swedish SMB is the design partner?** Build the demo on their real competitor set —
a report about a real Stockholm business beats a generic one in front of both judges and
customers.
