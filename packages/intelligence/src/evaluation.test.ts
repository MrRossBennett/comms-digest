import { expect, test } from "vite-plus/test";

import { scoreExtraction } from "./evaluation";
import { year4SwimmingFixture } from "./fixtures";

test("scores the semantic extraction fields independently and deterministically", () => {
  expect(scoreExtraction(year4SwimmingFixture.expected, year4SwimmingFixture.expected)).toEqual({
    claims: 1,
    responsibilities: 1,
    dates: 1,
    amounts: 1,
    audience: 1,
    citations: 1,
    overall: 1,
  });

  const wrongAmount = structuredClone(year4SwimmingFixture.expected);
  if (wrongAmount.responsibilities[0]?.amount) {
    wrongAmount.responsibilities[0].amount.minorUnits = 120;
  }

  expect(scoreExtraction(year4SwimmingFixture.expected, wrongAmount)).toMatchObject({
    claims: 1,
    amounts: 0,
    citations: 1,
  });
});

test("tolerates free-text variation in content and title while scoring objective fields correctly", () => {
  const actual = structuredClone(year4SwimmingFixture.expected);

  // Vary free-text fields without touching any objective field
  actual.claims[0]!.content = "Swimming starts next week for Year 4.";
  actual.claims[1]!.content = "Year 4 swimming payment needed.";
  actual.responsibilities[0]!.title = "Swimming payment";

  expect(scoreExtraction(year4SwimmingFixture.expected, actual)).toMatchObject({
    claims: 1,
    audience: 1,
    dates: 1,
    amounts: 1,
    citations: 1,
    responsibilities: 1,
    overall: 1,
  });
});

test("penalises claim coverage when the model produces extra unmatched claims", () => {
  const actual = structuredClone(year4SwimmingFixture.expected);

  // Inject an extra claim with a novel citation that doesn't match either expected claim
  actual.claims.push({
    content: "School trip on Monday.",
    audience: { scope: "school", originalWording: "all families" },
    certainty: "confirmed",
    citations: [{ quote: "Oakfield Primary", start: 118, end: 134 }],
  });

  const scores = scoreExtraction(year4SwimmingFixture.expected, actual);
  // Expected claims all still match (coverage = 1); extra actual claim is simply unmatched
  expect(scores.claims).toBe(1);

  // Flip it: fewer actual claims than expected → coverage < 1
  const fewer = structuredClone(year4SwimmingFixture.expected);
  fewer.claims = fewer.claims.slice(0, 1);
  expect(scoreExtraction(year4SwimmingFixture.expected, fewer).claims).toBeLessThan(1);
});
