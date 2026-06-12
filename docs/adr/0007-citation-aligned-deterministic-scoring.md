# ADR 0007: Citation-aligned deterministic scoring for extraction evaluation

**Status:** Accepted
**Date:** 2026-06-12
**Issue:** #1 (establish semantic-scoring baseline)

## Context

The tracer-bullet experiment (PR #2) showed all semantic scorer dimensions reading 0 despite
the model producing largely correct objective fields. The root cause: `scoreExtraction` used
exact-match on canonicalized tuples that bundled free-text `content`/`title` as alignment keys.
Any rephrasing of content zeroed every score, making the signal useless for iterating on the
extraction prompt.

The PRD (issue #1) mandates deterministic scorers — no LLM judge.

## Decision

1. **Align Claims by citation quote overlap, not by content.**  
   For each expected Claim, find the best matching actual Claim whose citation quotes overlap
   (either quote is a substring of the other). Greedy first-match assignment. Unmatched expected
   Claims penalise coverage.

2. **Score objective fields on aligned pairs.**  
   Scored fields: `audience.scope`, `date.resolvedDate`, `amount.minorUnits`, and citation
   coverage (expected quotes appear in actual quotes). Free-text fields (`content`, `title`,
   `audience.originalWording`, `date.originalWording`) are intentionally not scored — they
   are not objective and varied at the model's discretion.

3. **Align Responsibilities by position.**  
   With one fixture and one Responsibility, position alignment is sufficient. This can be
   upgraded to a keyed alignment (by amount + dueDate) as more fixtures are added.

4. **Claim-count discipline in the prompt, not only the scorer.**  
   Alongside the scorer rework, `extractionInstructions` in `live.ts` was updated to:
   - Prohibit bare date phrases as standalone Claims (dates attach via the `date` field).
   - Specify Audience scope values explicitly (year group = "group", not "school").
   - Require synthesized Claim content that embeds resolved dates.

## Consequences

- Scorer correctly rewards correct objective fields even when the model rephrases content.
- Free-text variation is tolerated, not penalised — deliberate.
- Citation overlap is a sufficient but not precise alignment signal; with future fixtures that
  share citation quotes across Claims it may produce mis-alignments. An exact-span overlap
  (using `start`/`end`) would be more precise but is not needed yet.
- Responsibility alignment by position breaks if the model reorders responsibilities; upgrade
  to keyed alignment when a fixture exposes the problem.
