import { modelExtractionSchema } from "./contracts";

function canonicalize(values: unknown[]) {
  return values.map((value) => JSON.stringify(value)).sort();
}

function exactScore(expected: unknown[], actual: unknown[]) {
  const expectedValues = canonicalize(expected);
  const actualValues = canonicalize(actual);

  return JSON.stringify(expectedValues) === JSON.stringify(actualValues) ? 1 : 0;
}

export function scoreExtraction(expectedInput: unknown, actualInput: unknown) {
  const expected = modelExtractionSchema.parse(expectedInput);
  const actual = modelExtractionSchema.parse(actualInput);

  const scores = {
    claims: exactScore(
      expected.claims.map(({ content, certainty }) => ({ content, certainty })),
      actual.claims.map(({ content, certainty }) => ({ content, certainty })),
    ),
    responsibilities: exactScore(
      expected.responsibilities.map(({ title, claimPositions }) => ({
        title,
        claimPositions: [...claimPositions].sort((left, right) => left - right),
      })),
      actual.responsibilities.map(({ title, claimPositions }) => ({
        title,
        claimPositions: [...claimPositions].sort((left, right) => left - right),
      })),
    ),
    dates: exactScore(
      [
        ...expected.claims.map(({ content, date }) => ({ content, date })),
        ...expected.responsibilities.map(({ title, dueDate }) => ({ title, dueDate })),
      ],
      [
        ...actual.claims.map(({ content, date }) => ({ content, date })),
        ...actual.responsibilities.map(({ title, dueDate }) => ({ title, dueDate })),
      ],
    ),
    amounts: exactScore(
      expected.responsibilities.map(({ title, amount }) => ({ title, amount })),
      actual.responsibilities.map(({ title, amount }) => ({ title, amount })),
    ),
    audience: exactScore(
      expected.claims.map(({ content, audience }) => ({ content, audience })),
      actual.claims.map(({ content, audience }) => ({ content, audience })),
    ),
    citations: exactScore(
      expected.claims.map(({ content, citations }) => ({ content, citations })),
      actual.claims.map(({ content, citations }) => ({ content, citations })),
    ),
  };

  return {
    ...scores,
    overall:
      Object.values(scores).reduce((total, score) => total + score, 0) / Object.keys(scores).length,
  };
}
