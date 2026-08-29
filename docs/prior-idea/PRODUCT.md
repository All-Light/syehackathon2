# PRODUCT.md — Lugn

> **Provenance:** derived from the user-approved `PLAN.md` and `PITCH.md` rather than from a
> fresh discovery interview, because the product truth was already settled with the user and the
> build is on a hard deadline (Sunday 10:00). Assumptions are labelled **[assumed]**.

## What it is

**Lugn** — an AI voice agent that lets Swedish frontline staff rehearse verbally tense
situations out loud, and grades how they handled it.

The trainee talks to a character who is angry, confused, stressed, condescending or
intoxicated. The character escalates or backs down in response to how the trainee actually
sounds. Afterwards they get a scored report with quotes from their own conversation.

## Who it is for

**Buyer:** the owner or manager of a Swedish shop, restaurant, or petrol station — often 1–20
staff, no HR department, no training budget line. They buy because **AFS 2023:2** obliges them
to train staff in threats and violence, and they currently have nothing that proves they did.

**User:** frontline staff. Often young, often their first job, on shift, on a phone, standing
up, possibly with 90 seconds to spare. **[assumed]** Low tolerance for setup, logins, or
anything resembling a course.

These are different people and the design serves the user, not the buyer. The buyer's needs are
met by one artifact: a report they can file.

## The job to be done

> "I have to be able to show my staff are trained, and I'd rather they didn't fall apart the
> next time someone screams at them across the counter."

Existing alternative: a PowerPoint about staying calm. You read that you should be calm. You
have never once had to *be* calm while someone shouted at you.

## Product truth that constrains design

- **Voice is the product.** The interface's job is to get out of the way of a conversation and
  then explain what happened. Any screen that competes with the voice is wrong.
- **The live call screen is also the demo video and the in-store sales demo.** It is seen by
  judges and by shop managers on a stranger's phone. It carries disproportionate weight.
- **Mobile portrait is the primary form factor**, not a responsive afterthought. Sellers hand
  a phone to a cashier standing behind a till.
- **Swedish-first.** All user-facing copy is Swedish. English is a fallback.
- **No login.** No account, no onboarding, no empty state to design. A link opens straight into
  something you can talk to.
- **60 seconds to value.** From opening the link to a voice arguing back. Anything that adds a
  step to that path is cut.

## Emotional register — the hard part

The subject matter is aggression, threat and fear. The product must not be:
- **gamified** — no streaks, confetti, badges, points. A shoplifting confrontation is not a game.
- **clinical** — not an LMS, not a compliance portal, not a dashboard.
- **frightening** — the anxiety belongs in the conversation, never in the interface.

The interface should feel the way a good trainer feels: **calm, steady, unhurried, and
unembarrassed about failure**. The user has just been shouted at by a machine and possibly
handled it badly, in front of their boss. The report must read as a coach, not a verdict.

The name is the brief: **Lugn** means calm. The interface is the calm around the storm.

## Success

- A cashier finishes a call and immediately wants to try again with a different persona.
- A manager watches 60 seconds of it over someone's shoulder and reaches for their card.
- Nobody asks what to do next on any screen.

## Non-goals

Dashboards · manager analytics · admin · course catalogues · certificates · scenario-editor UI ·
leaderboards · anything that makes this look like corporate e-learning.
