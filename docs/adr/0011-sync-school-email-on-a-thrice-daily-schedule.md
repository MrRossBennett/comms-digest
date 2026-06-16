# Sync school email on a thrice-daily schedule, deferring incremental sync

Comms Digest will keep each **Household**'s **School Communications** current with a background sweep that runs three times a day per Household, reusing the existing capped synchronous fetch — re-list `newer_than:30d` per **Communication Source**, dedupe by external message id, extract each message once — rather than polling continuously. The three sweeps are deliberately not evenly spaced: the evening sweep is anchored to where the **Day Plan** composition deadline will sit (Slice 3) so it doubles as the sync-then-compose trigger and is not rebuilt later; the morning and midday sweeps keep the in-app **Day Plan** warm between manual refreshes, which remain available.

Cadence is **not** driven by model cost, and the justification must not be written that way. Each email is extracted exactly once — deduped by external message id before extraction — so AI spend is a function of inbound email volume and is **independent of how often we sweep**. More frequent sweeps only multiply near-free Gmail list/get calls and job-scheduling overhead, not model spend. The cadence is chosen on two real grounds: the freshness requirement is low (manual refresh remains, and the only hard freshness deadline is the evening composition), and continuous or near-real-time sync would force the durable background-queue infrastructure that the **Ingestion scaling boundary** defers. A future decision to increase intraday freshness should therefore be weighed against queue infrastructure and Gmail quota — not against a model-cost concern that does not exist.

Incremental sync stays as the `newer_than:30d` re-list with dedupe. At three sweeps a day the re-list is cheap, and the 30-day window doubles as free resync-after-gap protection.

## Considered options

- **Continuous / near-real-time polling.** Rejected: no freshness need justifies it, and it forces the durable background queue the scaling boundary defers.
- **Gmail History API now.** Rejected as premature: it adds a "history too old" (HTTP 404) fallback path to buy efficiency over a re-list that is currently cheap.
- **Three evenly spaced sweeps.** Rejected: the evening sweep is anchored to the composition deadline so it can serve as the sync-then-compose trigger without rebuilding it.
- **Custom per-Household DB lock (advisory or row-level).** Rejected in favour of Inngest (see below): building a bespoke lock with lease math, stolen-while-alive gap, and atomic test-and-set is several hundred lines of infrastructure that Inngest's `concurrencyKey` replaces in one declaration.

## Job orchestration: Inngest

Slice 2 uses **Inngest** for cron scheduling, per-Household concurrency control, and retry. Inngest is a SaaS workflow platform with no infrastructure to run — it integrates via an HTTP endpoint on the existing server. This replaces the per-Household DB lock the slice would otherwise need:

- `concurrencyKey: householdId` on the `sync-household` Inngest function enforces exactly-one-running-per-Household, which is the core of the lock problem.
- The `household_sync` row becomes a lightweight status surface for the UI (idle / running / needsReauth) rather than a lock — it has no `lockedAt`, no lease, no stolen-while-alive gap to comment around.
- Retry with backoff is Inngest configuration, not code.
- Cron schedule (3x daily) is declared in the Inngest function, not a Railway cron entry.

**Trigger for migrating away from Inngest:** if Inngest's pricing, availability, or per-step latency becomes a constraint. The domain logic (`fetchAndIngestCoreForHousehold`, error classification) is isolated from the orchestration layer and would survive a migration.

**Trigger for the durable queue deferral** (from the Ingestion scaling boundary): when synchronous per-sweep fan-out across all Households no longer fits Inngest's execution window, or when per-Household bounded concurrency across many accounts needs more than `concurrencyKey` provides. At that point Inngest's fan-out / child workflow primitives, or a self-hosted queue (BullMQ / Temporal), are the candidate successors.

## Consequences

Revisit both the cadence and the History-API deferral when **either** intraday freshness becomes a genuine product requirement **or** Gmail API quota/usage shows pressure — the same trigger-condition style the scaling boundary uses for the durable queue. Concurrency control between the scheduler and manual refresh, and asynchronous surfacing of a dead Gmail connection, are required parts of this slice (a background sweep cannot rely on a parent watching a manual click for failures) and are specified with the slice rather than here.
