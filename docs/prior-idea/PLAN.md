# Lugn — AI voice agent for de-escalation training

## Context

We are ~12 hours into SweYoung Hackpack (28–30 Aug 2026, CMNTY Stockholm). It is Saturday
morning; the final submission deadline is **Sunday 10:00 sharp**. Roughly **27 hours remain**.

The idea: an AI voice agent that lets frontline staff rehearse verbally tense situations —
angry, confused, stressed, intoxicated customers — and get graded on how they handled it.
Differentiated from "just use ChatGPT voice" by four things: **vetted scenarios with explicit
win criteria**, **multiple voice personas per scenario**, a **real-time vocal-tension loop that
steers the AI character's escalation**, and **rubric-based grading with coaching feedback**.

Two facts from research reshape the plan:

1. **The rubric is a traction rubric.** Every track weights Traction 12–18p and Business
   Potential 16–18p, against Originality 6–8p. AI Agents track: Traction 12 / Problem 14 /
   Business 16 / Originality 8. A beautiful build with no paying customers loses to an ugly
   build with three. Roughly half the remaining hours belong to selling.
2. **Saturday is the only in-person selling day.** Stockholm retail is open ~10:00–18:00 today
   and does not open Sunday before the 10:00 deadline. Therefore the builders' first hard
   milestone is *not* a finished product — it is a **phone-demoable single scenario by 11:00**.

Team: 4 people — 2 technical (build), 2 non-technical (sell). Product direction: the webapp
stays deliberately small and clean; nearly all craft goes into making the **voice agent
genuinely good**.

**Wedge:** Swedish retail & hospitality frontline — butik, kassa, restaurang, bensinstation.
**Language:** Swedish-first, English fallback.
**Name:** `Lugn` (Swedish for "calm"). Alternates: Bemöta, Kallt Huvud, Tryggve.

### Why this wedge validates (load-bearing for Problem & Validation, 14p)

- **AFS 2023:2** — Arbetsmiljöverket's regulation on violence and threats at work obliges
  employers to prevent and to train staff. Training is a *legal requirement*, not a nice-to-have.
- **Svensk Handel, Trygghetsbarometern 2025** — Säkerhetsindex 44% of Swedish stores hit by
  theft, burglary, threats or violence in 2025; **68% in dagligvaruhandeln**; 63% in electronics;
  **Stockholm län worst at 63%**; Q4 2025 alone 48%.
- **Handels** — a third of members report more worry today than a year ago.
- Every incumbent (Hyperbound, Second Nature, Retorio, UneeQ) is **English-language sales
  roleplay**. Nobody is doing Swedish de-escalation for frontline retail. That is the moat.

Verify these numbers against the primary sources before the pitch; do not cite from memory.

---

## Product, in one screen each

Three screens. No login. No dashboard. No settings page.

1. **Välj scenario** — grid of 5 scenario cards; pick a persona chip (Arg / Förvirrad /
   Stressad / Passiv-aggressiv / Påverkad) and a difficulty. One button: *Starta samtal*.
2. **Samtalet** — full-bleed, near-empty. A single audio-reactive orb, a slim **"Ditt lugn"**
   meter, a timer, *Avsluta*. This screen is the demo video, so it must be beautiful.
3. **Rapport** — score ring, 5 rubric bars, the tension trace over the call, 3 quoted moments,
   3 concrete coaching actions, *Dela rapport* link.

Must work on a phone in portrait — the sellers demo it standing in a shop.

---

## Architecture

### The one trick that makes this buildable in a day

**One ElevenLabs agent, entirely driven by session overrides.** The scenario library is *data*,
not 15 configured agents. At `startSession` we override system prompt, first message, voice ID,
stability, speed and similarity boost. Scenario × persona = one composed prompt.

Overrides must be explicitly enabled per-field in the agent's **Security** tab first, or the
session errors. Enable: `prompt.prompt`, `first_message`, `language`, voice ID, stability,
speed, similarity boost.

### Stack

- **Next.js 15 App Router + TypeScript + Tailwind**, deployed on **Vercel**.
- **`@elevenlabs/react`** — `ConversationProvider`, `useConversationControls().startSession()`,
  `useConversationStatus()`. Node 24 is already on the machine; no pnpm/bun, use npm.
- **Supabase** — exactly one table (`reports`) so report links are shareable. No auth.
- **Grading LLM: `opencode-go/deepseek-v4-flash` via opencode**, behind a swappable interface
  (see *Grading* below). opencode 1.18.18 is already installed at `~/.opencode/bin/opencode`.
- Secrets: `ELEVENLABS_API_KEY`, `FIRECRAWL_API_KEY`, Supabase keys. Nothing is in the
  environment today — collect them first thing. The grader needs no key of its own; it rides
  the existing OpenCode Go credential.

### Data model (TypeScript, in-repo, no CMS)

```ts
type Persona = {
  id: string;
  namn: string;                 // "Arg och explosiv"
  voiceId: string;              // ElevenLabs Swedish voice
  voice: { stability: number; speed: number; similarityBoost: number };
  laddning: string;             // persona behaviour block, injected into the prompt
};

type Scenario = {
  id: string;
  titel: string;                // "Retur utan kvitto"
  miljo: string;                // setting, staff role, what just happened
  doldaFakta: string;           // what the character knows and the trainee does not
  vinstkriterier: string[];     // explicit win criteria, also fed to the grader
  forlustkriterier: string[];   // what ends the call badly
  trappa: string[];             // 5 escalation levels, concrete behaviours at each
  personas: Persona[];
};
```

### The escalation ladder — where the craft goes

The system prompt is composed from: scenario frame → persona block → **5-level escalation
ladder with concrete observable behaviour at each level** → movement rules (what makes the
character go up a level, what makes them come down) → guardrails.

Guardrails that matter, from experience with voice agents:
- Never break character, never coach, never acknowledge being an AI.
- **1–3 sentences per turn.** Long turns kill the realism and the interruption dynamics.
- Interrupt the trainee if they ramble or read from a script.
- Spoken Swedish register — fillers, contractions, sentence fragments. Not written Swedish.
- The character de-escalates *only* in response to specific trainee behaviours drawn from
  `vinstkriterier`. Otherwise the trainee learns nothing.

Budget a solid block of time to **actually run 20+ calls and tune this**. It is the product.

### The tension loop — the differentiator

A `useTension` hook, ~20Hz, no ML dependency:

- `conversation.getInputByteFrequencyData()` → band energy (RMS proxy), spectral centroid
  (vocal strain proxy), short-window variance.
- Transcript callbacks → words per second.
- Overlap detection → input energy high while `getOutputVolume()` is above threshold = the
  trainee interrupted.
- Combine, EMA-smooth, surface as a 0–100 **"Ditt lugn"** score driving the meter and the orb's
  colour (calm amber → tense red).

Then close the loop: every ~12s, or on a threshold crossing, call
`conversation.sendContextualUpdate("[REGI] ...")` — stage directions to the actor, e.g.
*"Trainee's voice is rising and they cut you off twice. Escalate one step."* or *"Trainee has
been steady and acknowledged your problem. Come down one step."*

**Call it what it is.** In the README, the UI and the pitch: a *vocal tension / calm proxy from
prosodic features*, **not** clinical emotion recognition. Judges open the GitHub, and the
hackpack disqualifies overclaiming. The honest version is also more impressive: it is a
closed control loop, which is exactly the "agent doing real work, not a chat wrapper" the
AI Agents rubric asks for.

Explicitly **cut** the server-side SER model (emotion2vec / wav2vec2-IEMOCAP). It is a Python
service, a model download and a latency problem, and it buys less than the prosody loop.

### Grading

Per-session ElevenLabs evaluation criteria are **not overridable**, so grade it ourselves —
which is better anyway, since the rubric becomes our IP rather than a config screen.

On `endSession`: take `conversation.getId()` → server route fetches the transcript from the
ElevenLabs conversation API → one grader call with the scenario's `vinstkriterier` and the
tension trace → structured JSON → store in Supabase → render.

**The grader is one interface with swappable adapters** (`lib/grader/`):

```ts
export type Grader = (input: GradeInput) => Promise<GradeReport>;
// selected by env: GRADER_PROVIDER = "opencode" | "openai-compatible"
```

- **`opencode` (default now).** `opencode run --pure -m $GRADER_MODEL -f <promptfile> --format json`,
  with `GRADER_MODEL=opencode-go/deepseek-v4-flash`. **Verified working** — it returns clean
  JSON. Two gotchas: strip the `> build · <model>` header and ANSI codes from stdout, and pass
  the transcript via `-f` / stdin rather than as an argv string, or a long conversation will
  blow up shell escaping.
- **`openai-compatible`.** Plain HTTPS POST to any OpenAI-shaped `/chat/completions`
  (`GRADER_BASE_URL`, `GRADER_API_KEY`, `GRADER_MODEL`). This is the swap-in path for a
  DeepSeek, OpenRouter or Anthropic key if one appears — no other code changes.

Keep the prompt, the rubric and the JSON schema in a provider-agnostic module; the adapters do
nothing but transport. Validate the returned JSON with a zod schema and retry once on a parse
failure — small fast models do occasionally wrap JSON in a fence.

**Deployment consequence — decide this early.** The OpenCode Go credential is only reachable
through the opencode binary, which does not exist on Vercel's serverless runtime. Either:
- run the Next.js app on the builder's laptop and expose it with `cloudflared tunnel` (simplest,
  one command, gives the sellers a phone URL), **or**
- deploy the app to Vercel and point `GRADER_URL` at a tunnelled `opencode serve --port 4096`
  on the laptop.

Either way the laptop must stay online during the selling window. So: **if the grader is
unreachable or times out, still render the report** — transcript, tension trace, timing and
win-criteria checks are all computed locally — with the AI rubric section marked *"analyseras…"*.
A report that dies in front of a buyer costs a sale, not just polish.

Rubric, five dimensions scored 0–4 each with a supporting quote from the transcript:
1. **Bemötande & tonläge**
2. **Aktivt lyssnande**
3. **Gränssättning & regelefterlevnad**
4. **Lösningsorientering**
5. **Egen reglering under press** (informed by the tension trace)

Plus: 3 concrete *"säg så här istället"* rewrites with exact alternative phrasing, and 2
replayable moments (timestamp, quote, what happened).

### Scenario library — 5 scenarios × 3 personas

1. **Retur utan kvitto** — customer demands a refund with no receipt.
2. **Misstänkt snatteri vid utgången** — the AFS 2023:2 scenario. Highest stakes.
3. **Berusad gäst vill beställa mer** — refusing service, restaurant/bar.
4. **Lång kö, utskälld i kassan** — queue rage.
5. **"Jag vill prata med chefen"** — demanding escalation, threatening to report.

Personas: **Arg-explosiv**, **Passiv-aggressiv/nedlåtande**, **Förvirrad-ledsen**,
**Stressad-jäktad**, **Påverkad-oberäknelig**. Voice settings per persona: angry = low
stability + slightly raised speed; confused = high stability, slower; stressed = fast.

Use **audio environment** (store ambience) for realism — it is cheap and it lands on camera.

**Dictate all of this with the Aqua Voice desktop app**, then screenshot the history. That is a
$500 prize for work you were doing anyway, and dictation is genuinely faster for writing 15
character briefs.

### Firecrawl feature — "klistra in er hemsida"

Paste a shop's URL → Firecrawl scrapes their site (products, return policy, opening hours) →
generate a company-specific scenario where the AI customer complains about *their actual
product* and cites *their actual return policy*.

This is worth an hour. It is a closing tool in the sales conversation — walk into a store,
paste their URL, and 30 seconds later the trainee is handling their real returns policy — and
it uses the Firecrawl credits meaningfully.

---

## First deliverables (written immediately on approval, before any code)

Both land in the repo root so the sellers can work from them while the builders scaffold.

### `PLAN.md`
This plan, committed to the repo. Doubles as the "what we built this weekend" source material
for the submission form.

### `PITCH.md`
Two audiences, one file:

1. **Jury pitch, 3 minutes + 2 min Q&A** — structured to the rubric the judges actually score:
   problem (AFS 2023:2 + the Svensk Handel numbers) → why a voice agent is the *right* tool and
   not a chat wrapper (the closed tension loop) → live demo beat → traction with real numbers →
   business model and path → what existed before the weekend vs. what we built. Written to be
   read aloud, with the demo beat marked and timing per section. Includes the anticipated Q&A:
   *"why not just ChatGPT voice?"*, *"how is this defensible?"*, *"what's the tension meter
   really measuring?"* — answered honestly.
2. **Customer hook, 1–3 sentences** — what a seller says in the first ten seconds to a store
   manager, leading with the legal obligation because that is what makes a boss stop walking.
   Plus two or three variants for restaurant, petrol station and chain-HQ, and the one-line
   price/offer close. Swedish, with English glosses for the team.

The sellers leave with the hook memorised before 10:00.

---

## Timeline

Two lanes. **B1/B2** = builders, **S1/S2** = sellers. Times are Saturday unless stated.

### Builders

| When | B1 (app & UI) | B2 (agent & backend) |
|---|---|---|
| 07:00–09:00 | Next.js + Tailwind scaffold, deploy to Vercel on commit 1 | ElevenLabs agent created, **overrides enabled in Security tab**, hello-world call round-trips |
| 09:00–11:00 | Call screen: orb, timer, start/stop. Portrait phone layout. | Scenario 1 + 3 personas written and voice-tuned |
| **11:00** | **🔴 HARD MILESTONE — one scenario live on a phone URL, handed to S1/S2** | |
| 11:00–14:00 | Scenario picker, persona chips | Remaining 4 scenarios × personas; escalation ladders |
| 14:00–17:00 | `useTension` hook + calm meter + orb colour | Transcript fetch → grader adapter → report JSON |
| 17:00–19:00 | Report screen | `sendContextualUpdate` escalation loop wired to tension |
| 19:00–21:00 | **Both: 20+ real calls, tune prompts and voices.** This is the product. | |
| 21:00–23:00 | Shareable report links, team slugs (`lugn.app/butiken-x`) | Firecrawl URL→scenario |
| 23:00–02:00 | Polish, mobile QA, audio environment, error states | README, GitHub tidy, .env.example |
| 02:00–04:00 | **Demo video** — 2–3 min, product actually working, EN subtitles | |
| 04:00–08:00 | Sleep / buffer | |
| **Sun 08:00** | **Submit a complete draft.** Refine until 09:45. Never risk 10:00. | |

### Sellers

| When | S1 + S2 |
|---|---|
| 07:00–10:00 | Read `PITCH.md`. Stripe Payment Link at **495 kr / pilot**. One-page Swedish LOI, phone-signable. Memorise the door hook. Print the QR. Build a target list: Drottninggatan, Gallerian, MOOD, Sturegallerian, Åhléns-area, plus restaurants and petrol stations. |
| 10:00–11:00 | Rehearse the script; pitch from the demo video until the live link lands |
| **11:00–18:00** | **🔴 The only in-person window. Walk stores with a phone.** Target 20–25 visits. |
| 18:00–21:00 | Warm network, LinkedIn, email to store/restaurant managers with the live link |
| 21:00–23:00 | **Linkup post** and **Freebuff post** — separate posts, each naming one tool, saying how it actually helped, ending in a CTA. Two more prizes. |
| 23:00–02:00 | Deck + 3-min pitch. Collect proof files: Stripe screenshots, signed LOIs, in-store photos |

**Door script (the AFS angle opens doors):** *"Har ni utbildat personalen i hot och våld? Det är
krav sedan AFS 2023:2. Vi har byggt en AI som låter personalen träna på riktiga situationer på
svenska — får jag visa på 60 sekunder?"* Then hand them the phone and let a staff member try it.
Letting them *talk to it* is the close; describing it is not.

**Offer:** 495 kr pilot — 5 svenska scenarier, obegränsad träning i 30 dagar, en rapport per
anställd som går att lägga i det systematiska arbetsmiljöarbetet.

**Target:** 2–4 real payments + 5+ signed LOIs. On the Outbuild ladder 3+ paying customers is
the full 18p; on AI Agents 2+ paying is the full 12p.

**Disqualification risk — read this.** The hackpack disqualifies teams whose "paying users" are
friends paying for their own product. Every payment must come from a genuinely unaffiliated
business. No exceptions, no shortcuts.

---

## Submission

Tick **AI Agents** (primary), **Outbuild**, and **Wildcard**. The FAQ states ticking more can
only help, and tracks are scored independently. Edtech B2C is a weak fit (B2B, not students) —
tick it only as a free option.

Checklist, per the hackpack:
- Project name, team name, all members
- Tracks ticked
- **Demo video** — public link, product visibly working
- **GitHub link** — required, judges open it. No link, no prize.
- Live product link
- **Proof files** (up to 8): Stripe payment screenshots, signed LOIs, in-store demo photos,
  **Aqua Voice history screenshots**
- Written traction: what existed before the weekend (nothing), what was built during it, with
  specific numbers

Sponsor prizes in reach: **ElevenLabs Best Build** (core to the product, automatic),
**Aqua Voice cool project** ($500, needs history screenshots), **Linkup** and **Freebuff**
marketing prizes (one post each, separate). Use Linear for the sprint board.

---

## Verification

The loop to check end-to-end, on a phone, before anything is called done:

1. `npm run dev`, open on a phone on the same network (or the Vercel preview URL).
2. Pick *Retur utan kvitto* + *Arg-explosiv*. Grant mic. Call connects under 2s.
3. The character opens in spoken Swedish, in character, in 1–3 sentences.
4. **Raise your voice and interrupt.** Within ~15s the calm meter drops and the character
   escalates a level. This is the money shot — it must be reliable on camera.
5. **Then de-escalate**: acknowledge, apologise, offer a concrete solution. The character comes
   down a level and the meter recovers.
6. End the call. Report renders in under ~20s with five scored dimensions, real quotes pulled
   from the transcript, and the tension trace.
   Then **kill the grader** (stop the tunnel or the opencode server) and repeat: the report must
   still render with the transcript, timings and tension trace, rubric marked *"analyseras…"*.
7. Open the shared report link in a private window — it renders without auth.
8. Repeat on iOS Safari and Android Chrome. Mic permissions and audio autoplay differ; the
   sellers are on phones all day and a broken phone demo costs sales, not just polish.

Also run the Firecrawl path once: paste a real Stockholm store URL, confirm the generated
scenario references their actual products or policy.

---

## Scope explicitly cut

Auth · dashboards · admin · manager analytics · server-side speech-emotion models · multi-tenant
billing · a scenario editor UI · English UI parity beyond a fallback · tests beyond manual QA.

If the schedule slips, cut in this order: **Firecrawl feature → shared report links → report
screen polish → 5 scenarios down to 3**. Never cut the tension loop or the voice tuning block —
they are the product and the demo.

---

## Live configuration (done — Saturday 07:5x)

**Agent:** `SYE` — `agent_0401m16159kgemft4fwxhyp7eshg`
Key is in `.env` as `ELEVENLABS_API_KEY`. It is **scoped** — it lacks `user_read`, so
`/v1/user/subscription` returns 401. Read the quota in the dashboard, or add the scope.

`.env` was **not** gitignored. Fixed — `.gitignore` now covers `.env`, `.env*.local`,
`node_modules/`, `.next/`, `.vercel`. Judges open the repo; never commit the key.

Applied to the agent via the API:

| Setting | Value | Why |
|---|---|---|
| `agent.language` | `sv` | Swedish-first |
| `tts.model_id` | `eleven_flash_v2_5` | **Required** — see constraint below |
| `tts.voice_id` | `ISDDl0xPNLMD73L5PQj4` (Filip) | default; personas override per session |
| `conversation.max_duration_seconds` | `300` (was 600) | budget guard — a forgotten tab burns minutes |
| overrides: `prompt.prompt`, `first_message`, `language`, `voice_id`, `stability`, `speed`, `similarity_boost` | **enabled** (all were `false`) | the entire one-agent architecture depends on these |

### Constraint found the hard way
**Non-English agents must use `eleven_turbo_v2_5` or `eleven_flash_v2_5`.** Setting
`language: "sv"` with any other TTS model returns
`400 Value error, Non-english Agents must use turbo or flash v2_5`.
Chose **flash** for latency — interruption timing is what makes an argument feel real.
A/B it against **turbo** during the voice-tuning block; turbo is more expressive, flash is faster.

### Persona voices — added to the workspace
Shared voices must be added to the workspace before an agent can use them, or the PATCH fails
`voice_not_found`. These five are added and ready:

| Voice ID | Workspace name | Persona |
|---|---|---|
| `ISDDl0xPNLMD73L5PQj4` | SV Filip Arg | Arg-explosiv (young, excited) |
| `SrEXuatZsaPiMUKtNYnc` | SV Henrik Nedlatande | Passiv-aggressiv (deep, composed) |
| `GTaiOJIilTdNU9B8S57K` | SV Tobias Stressad | Stressad-jäktad |
| `ycdKCM2Fj0Us7dTwCGoM` | SV Lisa Forvirrad | Förvirrad-ledsen (gentle) |
| `nUyEO72Kt4m7OfaEnvI7` | SV Signe Kravmaskin | Kravmaskin (confident) |

There are 100+ Swedish shared voices; swap freely during tuning.

---

## Credit budget — 10 000 is not enough

Published ElevenAgents allowances: **Free 15 min · Starter 75 · Creator 275 · Pro 1 238 ·
Scale 3 738 · Business 12 375.** Extra minutes $0.08/min, burst $0.16/min, text $0.003/message.
Agent LLM and telephony bill separately.

**10 000 credits ≈ 15 minutes ≈ five tuning calls.** The weekend needs roughly:

| Use | Minutes |
|---|---|
| Prompt + voice tuning (~40 calls) | 100 |
| Builder QA across the day | 40 |
| In-store seller demos (~40 sessions) | 80 |
| Demo video takes | 30 |
| Pitch rehearsal + live pitch | 20 |
| Pilot customers actually using it | 100+ |
| Buffer | ~80 |
| **Total** | **≈ 450 min** |

**Recommendation: Pro ($99, 1 238 min).** Comfortable, and trivially justified against a
25 000 kr first prize plus the ElevenLabs Scale category prize. Creator (275 min — the tier the
hackathon's "1 month of ElevenLabs" gives) is survivable only with strict discipline; redeem
that kickoff credit either way.

### The 20x saving — iterate in text mode
The `conversation.text_only` override is **already enabled** on the agent. Text messages cost
**$0.003 each vs $0.08/min of voice**. So: tune scenario logic, escalation ladders and
persona behaviour in **text mode**, and spend voice minutes only on voice tuning, demos,
selling and the video. Build the text harness first — it pays for itself immediately.

Also note `bursting_enabled: true` and `agent_concurrency_limit: -1`. With two sellers demoing
while builders test, concurrent calls can trigger burst pricing at double rate. Leave it on —
a rejected call in front of a buyer is worse than a 2x charge — but know it is there.

---

## WhatsApp — roadmap, not this weekend

The agent object has a first-class `whatsapp_accounts` field (currently `[]`), and the
integration genuinely fits: **inbound voice notes are transcribed and passed to the agent, and
it replies with voice notes by default.** Staff train by sending a voice note — no app, no
login, no password. That removes essentially all onboarding friction for frontline workers.

**Blocked for this weekend:** it requires importing a **WhatsApp Business Account** and
authorising ElevenLabs via Meta. Meta's business verification is not same-day and the docs give
no approval time. Do not put it on the critical path before Sunday 10:00.

**Do use it in the pitch**, honestly labelled as next: it is a strong answer to "how does this
scale to a chain of 100 stores" — no rollout, no IT project, staff already have WhatsApp. One
caveat to be aware of: WhatsApp penetration is lower in Sweden than in southern Europe, so it
is a stronger story for international expansion than for the Swedish beachhead. If a judge
pushes, say that.

---

## Build log — what's actually running (Saturday morning)

Next 16.3.3 · React 19.2.8 · Tailwind 4 · `@elevenlabs/react` 1.15.0.
`npm run build` clean with **zero warnings**, `npx eslint .` clean, `tsc --noEmit` clean.
Routes: `/` (static), `/[scenario]` (SSG, `/snatteri`), `/api/token`, `/api/rapport`.

Deployed target: **syehackaton.vercel.app**. `next lint` no longer exists in Next 16 — use
`npx eslint .`.

### Grader — switched off the CLI entirely
`opencode-go` turned out to be a plain **OpenAI-compatible HTTP endpoint**:
`https://opencode.ai/zen/go/v1`, keyed by `OPENCODE_API_KEY`, model `deepseek-v4-flash`.
That removes the binary dependency, so grading runs natively on Vercel and the whole
"tunnel a laptop" problem in the section above is **moot**.

Two latency findings, both measured on the same prompt:
- **Passing the prompt via `opencode run -f <file>` costs an agent tool-call round trip:
  53–120s, versus ~21s passing it inline as argv.** Moot now, but worth knowing.
- **`deepseek-v4-flash` is a reasoning model.** Left alone it burns ~9 300 completion tokens
  thinking and takes **92s**. With `reasoning_effort: "minimal"` it is ~3 200 tokens and
  **43s**. That parameter is load-bearing — do not remove it.

Grading still takes ~40s, so the report screen renders the measured half instantly
(length, average calm, interruptions, the tension curve) and fills in the rubric after.
Three states: analysing / done / failed — a failure says so rather than spinning forever.

Adapters live in `lib/grader/`: `zen.ts` (default) and `openaiCompatible.ts` (any other
OpenAI-shaped endpoint via `GRADER_BASE_URL`/`GRADER_API_KEY`). The prompt, rubric and zod
schema sit in `index.ts` and are provider-agnostic.

### Files that matter
- `lib/scenarios.ts` — the whole library as data. Snatteri + 3 personas written.
- `lib/prompt.ts` — composes scenario × persona into one system prompt, plus `regi()` stage directions.
- `lib/useTension.ts` — the prosody loop.
- `components/Ovning.tsx` — one route, three states (val → samtal → rapport).
- `components/Orb.tsx` — rAF writing CSS vars, no re-render per frame.

### Still open
- `SUPABASE_URL` is missing — the key alone is useless, so shareable report links are not wired.
- **Vercel env vars must be set**: `ELEVENLABS_API_KEY`, `OPENCODE_API_KEY`.
- The voice loop itself is **untested** — it needs a real browser and microphone.

### Supabase — wired
Project `jdegtuwlugltxxclirsv`. One table, `public.rapporter`, holding a graded conversation;
the row's uuid is the capability for its share link (`/r/<id>`).

Security posture: **RLS on with zero policies**, and privileges granted to `service_role` only
(`anon` and `authenticated` explicitly revoked). Every read and write goes through our server
routes using the `sb_secret_...` key. Verified both directions: the server reads fine, and the
publishable key gets `permission denied`. The security advisor's `rls_enabled_no_policy` notice
is the intended design, not a defect.

Gotcha: a table created through the MCP migration does **not** inherit grants for
`service_role` — the first read failed `42501 permission denied` until they were granted
explicitly. Any new table needs the same grant.

The report is persisted **even when grading fails**, so the measured half is never lost, and
`/api/rapport` returns the row id so the client can offer "Dela rapport".
