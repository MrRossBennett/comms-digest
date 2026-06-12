import { modelExtractionSchema, type ModelExtraction } from "./contracts";

type ModelClaim = ModelExtraction["claims"][number];
type ModelCitation = ModelClaim["citations"][number];
type ModelResponsibility = ModelExtraction["responsibilities"][number];

function quotesOverlap(a: ModelCitation[], b: ModelCitation[]): boolean {
  return a.some((ca) => b.some((cb) => ca.quote.includes(cb.quote) || cb.quote.includes(ca.quote)));
}

function alignClaims(expected: ModelClaim[], actual: ModelClaim[]): Map<number, number> {
  const alignment = new Map<number, number>();
  const usedActual = new Set<number>();

  for (let ei = 0; ei < expected.length; ei++) {
    for (let ai = 0; ai < actual.length; ai++) {
      if (usedActual.has(ai)) continue;
      if (quotesOverlap(expected[ei]!.citations, actual[ai]!.citations)) {
        alignment.set(ei, ai);
        usedActual.add(ai);
        break;
      }
    }
  }

  return alignment;
}

function citationsCover(expected: ModelCitation[], actual: ModelCitation[]): boolean {
  return expected.every((ec) =>
    actual.some((ac) => ac.quote.includes(ec.quote) || ec.quote.includes(ac.quote)),
  );
}

function ratio(numerator: number, denominator: number, fallback = 1): number {
  return denominator > 0 ? numerator / denominator : fallback;
}

export function scoreExtraction(expectedInput: unknown, actualInput: unknown) {
  const expected = modelExtractionSchema.parse(expectedInput);
  const actual = modelExtractionSchema.parse(actualInput);

  const claimAlignment = alignClaims(expected.claims, actual.claims);
  const matchedPairs = [...claimAlignment.entries()].map(([ei, ai]) => ({
    expected: expected.claims[ei]!,
    actual: actual.claims[ai]!,
  }));

  const claims = ratio(matchedPairs.length, expected.claims.length);

  const audience = ratio(
    matchedPairs.filter((p) => p.expected.audience.scope === p.actual.audience.scope).length,
    matchedPairs.length,
    claims,
  );

  const citations = ratio(
    matchedPairs.filter((p) => citationsCover(p.expected.citations, p.actual.citations)).length,
    matchedPairs.length,
    claims,
  );

  // Align responsibilities by position (sufficient for current fixture set)
  const minResponsibilities = Math.min(
    expected.responsibilities.length,
    actual.responsibilities.length,
  );
  const responsibilityPairs: { expected: ModelResponsibility; actual: ModelResponsibility }[] =
    Array.from({ length: minResponsibilities }, (_, i) => ({
      expected: expected.responsibilities[i]!,
      actual: actual.responsibilities[i]!,
    }));

  const responsibilities = ratio(responsibilityPairs.length, expected.responsibilities.length);

  const amountBearingPairs = responsibilityPairs.filter((p) => p.expected.amount != null);
  const amounts = ratio(
    amountBearingPairs.filter((p) => p.expected.amount!.minorUnits === p.actual.amount?.minorUnits)
      .length,
    amountBearingPairs.length,
  );

  const dateBearingClaimPairs = matchedPairs.filter((p) => p.expected.date != null);
  const claimDateMatches = dateBearingClaimPairs.filter(
    (p) => p.expected.date!.resolvedDate === p.actual.date?.resolvedDate,
  ).length;

  const dueDateBearingPairs = responsibilityPairs.filter((p) => p.expected.dueDate != null);
  const dueDateMatches = dueDateBearingPairs.filter(
    (p) => p.expected.dueDate!.resolvedDate === p.actual.dueDate?.resolvedDate,
  ).length;

  const totalDateBearers = dateBearingClaimPairs.length + dueDateBearingPairs.length;
  const dates = totalDateBearers > 0 ? (claimDateMatches + dueDateMatches) / totalDateBearers : 1;

  const scores = { claims, responsibilities, dates, amounts, audience, citations };
  return {
    ...scores,
    overall:
      Object.values(scores).reduce((total, score) => total + score, 0) / Object.keys(scores).length,
  };
}
