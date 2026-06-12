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
