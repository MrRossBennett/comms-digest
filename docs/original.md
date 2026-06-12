# Project Brief — Correspondence-Intelligence Pipeline

_(working instance: "School Comms")_

## Handoff note (read first)

This is a build brief for a coding agent. The human owner has reviewed and approved the scope below. **Build Phase 1 first, confirm it passes its acceptance criteria, then proceed.** When a decision is ambiguous, prefer the _smaller_ scope — this is a side project, not a product (yet).

The **only hard technical requirement is TypeScript end to end.** Every library named below is a recommended default you may swap, provided everything stays in TS.

---

## What this is, and why it exists

A multi-step **agentic pipeline** that turns the chaos of school communications (emails, PDF newsletters, form notifications) into a single **trustworthy, prioritised, personalised** view of what matters and what the parent needs to do — with **every claim cited back to its source**, and an **eval suite that proves it beats a naive single-prompt agent**.

**Primary purpose: a calling card for job interviews** — specifically senior/AI-native engineering roles that ask for agent orchestration, document review, structured extraction, and reliability engineering. The thing being shown off is not "an app"; it is **the judgment to make an agent measurably reliable and trustworthy**, which is the rarest signal in this space.

**Framing for interviews — the "biggest hit in agents" line:**

> "A pipeline that ingests messy multi-source correspondence, extracts structured actions, reconciles duplicates and contradictions across sources, and cites every claim back to its source — with an eval suite measuring extraction and citation accuracy against a naive-agent baseline. The same shape is exactly what document-heavy, regulated workflows need."

**Secondary, optional: a real SaaS path exists** (validated market — Fambot, Ohai, ParentXP all attack this). See the final section. The build de-risks that exploration without committing to it.

---

## The core thesis (protect this above all)

A general agent with a Gmail connector can already produce a rough daily summary. So the value of _this_ build lives entirely in the gap a general agent leaves:

1. **Measurable reliability** — an eval harness, run in CI, with a **naive single-prompt agent as the baseline** so the improvement is provable.
2. **Provenance** — every surfaced item links to the exact source line; zero tolerance for unsourced claims.
3. **Durable state** — tracks what's _outstanding_ over time, not just a one-off summary.

If any of these three is cut, the project loses its point. Cut features elsewhere first.

---

## Scope

### ✅ Phase 1 — core (build and prove this first)

- **Input:** a fixtures corpus of ~15–20 synthetic emails + 1–2 synthetic PDF newsletters + a few mock form-notification emails. This corpus is _also_ the eval dataset.
- **Pipeline (typed, multi-step):**
  1. Ingest + extract text (PDF → text).
  2. Extract structured items (event / deadline / action / info) into a Zod schema, tagged with year-group/child.
  3. Reconcile across sources: dedup the same event announced multiple ways.
  4. Attach **provenance** to every item (source id + supporting quote/span).
- **Output (push — the star):** a digest filtered to the owner's children's year groups + an **"outstanding actions"** list. Every item is click-to-source.
- **Scoping:** hardcoded family config (kids → year groups). No auth.
- **Eval harness (first-class — see dedicated section).**

### ✅ Phase 2 — live demo (after Phase 1 is green)

- A second input adapter (`GmailSource`) reading the owner's real Gmail (read-only).
- Optional: write digest events to a **dedicated secondary "School" calendar** (never the primary).
- This runs through the _same_ pipeline. It is a demo/personal-use surface; it must not touch the eval backbone.

### ❌ Explicitly OUT of scope / non-goals

These are deliberate. Do not build them without the owner's say-so:

- **No outbound.** The system never sends email/messages on anyone's behalf. (Read-only stance, matching what funded products in this space do.) At most, _draft for the human to send_ — and even that is optional.
- **No multi-tenant auth / accounts.** Single household, hardcoded config.
- **No multi-provider ingestion.** Gmail only for the live demo; Outlook/iCloud out.
- **No capturing app-locked comms** (ClassDojo / Arbor / Class Charts etc.). Email + PDF only.
- **No recommendation engine.**
- **A parent-facing Q&A/chat surface is NOT the headline** and is out of MVP. If built later, it must answer _only_ from the structured, cited store and **refuse when it doesn't know** rather than hallucinate.

---

## Architecture

### Input adapters (key pattern)

A single `Source` interface with two implementations, so the pipeline is identical regardless of where data comes from:

- `FixtureSource` — reads the synthetic corpus from disk (used for evals, CI, and a private-data-free demo).
- `GmailSource` — reads real mail via the Gmail API (Phase 2).

### Pipeline stages

Implement as a typed sequence of steps. Default: **Vercel AI SDK `generateObject` + Zod** for structured extraction. _(LangGraph.js is an acceptable swap if the owner wants that framework named on a CV; it adds ceremony, so it is not the default for a side project.)_

`ingest/parse → extract (structured) → reconcile/dedup → attach provenance → persist → render (digest + outstanding)`

### Data model & provenance (indicative — refine as needed)

```ts
type Source = {
  id: string;
  kind: "email" | "pdf_newsletter" | "form_notification";
  receivedAt: string; // ISO
  subject?: string;
  rawText: string; // PDF already extracted to text
};

type Provenance = {
  sourceId: string;
  quote: string; // the exact supporting span (also powers click-to-source)
};

type ExtractedItem = {
  id: string;
  type: "event" | "deadline" | "action" | "info";
  title: string;
  date?: string; // ISO
  dueDate?: string; // ISO (actions)
  amount?: number; // e.g. 12 (£)
  yearGroups?: string[]; // e.g. ['Year 4']
  status?: "outstanding" | "done";
  provenance: Provenance[]; // MUST contain >= 1 — no unsourced items
};
```

### Output surfaces

- **Digest** — grouped/prioritised, filtered to configured year groups.
- **Outstanding actions** — durable list with status.
- Minimal **Next.js** UI: one page showing both, with click-to-source revealing the cited quote in context. Keep it simple.

### Tech stack (TypeScript end to end — the one hard rule)

| Concern                       | Default (swap freely, stay TS)                 |
| ----------------------------- | ---------------------------------------------- |
| Runtime                       | Node + TypeScript                              |
| LLM calls / structured output | Vercel AI SDK (`generateObject`) + Zod         |
| Model provider                | Anthropic or OpenAI, kept swappable            |
| Datastore                     | SQLite + Drizzle ORM (Postgres if preferred)   |
| PDF → text                    | a TS/JS extractor (e.g. `unpdf` / `pdf-parse`) |
| Google APIs                   | `googleapis` (Gmail `readonly` + Calendar)     |
| Evals                         | Vitest, run in GitHub Actions CI               |
| Frontend                      | Next.js (App Router) + Tailwind, minimal       |
| Observability (optional)      | Langfuse for tracing                           |

---

## Eval harness (the headline artifact — do not skimp)

The eval is the cheapest part to build and the entire reason the project is impressive.

- **Dataset:** annotate every fixture with ground truth — the events, deadlines, actions, amounts, year-groups it contains, and the source span for each.
- **Metrics:**
  - extraction precision/recall (events, deadlines, actions),
  - **citation accuracy** — does each cited span actually support its claim?
  - correct year-group routing,
  - **hallucination rate** — items not grounded in any source (target: ~0).
- **Baseline comparison (the money shot):** run a _naive single-prompt agent_ over the raw corpus on the same dataset and report the delta on the metrics above. This table goes in the README.
- **(If Q&A is ever added):** a refusal eval — does it say "I don't know" when the answer isn't in the corpus?
- **CI:** evals run on every PR and **fail below thresholds** (a real regression gate).

---

## Acceptance criteria (definition of done — MVP)

1. Running the pipeline over the fixtures produces a digest + outstanding-actions list filtered to the configured year groups.
2. Every surfaced item has at least one provenance entry, and click-to-source shows the supporting quote.
3. The eval suite runs via `vitest` in CI, reports all metrics above, and includes the naive-agent baseline with a measured delta.
4. No item is surfaced that isn't grounded in a source (hallucination rate ~0 on the fixtures).
5. README contains: the thesis, an architecture sketch, the eval results table, and a demo (gif/video).

---

## Repo & README expectations (this _is_ the deliverable)

Because it's a portfolio piece, the README does real work and should include:

- The one-line thesis and the problem it solves.
- A short architecture diagram / description (adapters → pipeline → provenance → outputs).
- **The eval results table** (pipeline vs naive baseline) — the centrepiece.
- A demo gif or video.
- A **"Production / scaling considerations"** section: how live ingestion works at scale (OAuth, the restricted-Gmail-scope verification, the inability to capture app-locked comms), children's-data / GDPR, multi-provider support, multi-tenant auth — i.e. evidence the author understands the system they'd actually have to ship.

**Hygiene:** never commit secrets (`.gitignore` the client secret + refresh token; use env). Scrub real names/content from any screenshots or demo output, since it's a public repo touching family data.

---

## Future / possible SaaS path (real, but not now)

The market is validated — funded teams (Fambot, Ohai, ParentXP) already do parent-side AI school-comms triage. That's good news for the portfolio (you're building a credible version of a funded category) and sobering for the product dream (you'd be a late entrant).

If the owner ever pursues it as a product, the genuine **wedges**: non-Gmail providers; **app-locked comms** that never hit email (the hardest, most valuable gap); a **UK-specific** build (ParentMail/Arbor/Class Charts, INSET days, dinner money, year groups — incumbents look US-centric); and a **provenance/"prove it's right"** angle that the convenience-focused incumbents don't show off. The **structural** challenges are not the AI (you'll have built it) but ingestion/data-access, consumer acquisition cost, and low willingness-to-pay. Read-only + trust (no training, delete-on-disconnect) is the positioning axis.

The build de-risks all of this: you end up owning the engine, so the remaining product question is purely go-to-market, testable cheaply by onboarding a handful of real families.

---

## Suggested build order

1. **M1** — fixtures + schemas + extraction → structured items with provenance.
2. **M2** — reconcile/dedup + year-group filtering + digest & outstanding output.
3. **M3** — eval harness + naive baseline + CI gate.
4. **M4** — minimal Next.js UI with click-to-source.
5. **M5 (Phase 2)** — `GmailSource` adapter + Calendar write to a dedicated "School" calendar.
6. **M6** — README polish, demo capture, production-considerations writeup.
