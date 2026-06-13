import { expect, test } from "vite-plus/test";

import { runDigestBenchmark } from "./benchmark";
import { multiCommunicationBenchmark } from "./scenario";

test("the staged pipeline beats the naive baseline on the multi-communication scenario", async () => {
  const result = await runDigestBenchmark(multiCommunicationBenchmark);

  expect(result.pipeline).toMatchObject({
    precision: 1,
    recall: 1,
    routingAccuracy: 1,
    citationCoverage: 1,
    hallucinationRate: 0,
  });
  expect(result.naive).toMatchObject({
    precision: 0.25,
    recall: 0.25,
    routingAccuracy: 0,
    citationCoverage: 1,
    hallucinationRate: 0.75,
    overall: 0.375,
  });
  expect(result.delta).toBe(0.625);
});
