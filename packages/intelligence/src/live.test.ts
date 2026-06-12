import { expect, test } from "vite-plus/test";

import { year4SwimmingFixture } from "./fixtures";
import { createLiveExtractor } from "./live";

test("uses configured model extraction and records reproducibility metadata", async () => {
  const live = createLiveExtractor(
    {
      provider: "anthropic",
      modelId: "claude-haiku-4-5-20251001",
      promptVersion: "school-extraction-v1",
    },
    {
      generate: async () => ({
        output: year4SwimmingFixture.expected,
        usage: { inputTokens: 1_000, outputTokens: 200, totalTokens: 1_200 },
      }),
    },
  );

  await expect(live.extract(year4SwimmingFixture.communication)).resolves.toEqual(
    year4SwimmingFixture.expected,
  );
  expect(live.getLastRunMetadata()).toMatchObject({
    provider: "anthropic",
    modelId: "claude-haiku-4-5-20251001",
    promptVersion: "school-extraction-v1",
    inputTokens: 1_000,
    outputTokens: 200,
    totalTokens: 1_200,
    estimatedCostUsd: 0.002,
  });
});

test("re-derives citation offsets from the model's verbatim quote", async () => {
  const live = createLiveExtractor(
    {
      provider: "anthropic",
      modelId: "claude-haiku-4-5-20251001",
      promptVersion: "school-extraction-v2",
    },
    {
      generate: async () => ({
        output: {
          claims: [
            {
              content: "Swimming lessons start next Monday.",
              audience: { scope: "group", originalWording: "Year 4" },
              certainty: "confirmed",
              // Correct quote, miscounted offsets — the milestone-1 failure mode.
              citations: [{ quote: "Swimming lessons start next Monday", start: 0, end: 34 }],
            },
          ],
          responsibilities: [],
        },
        usage: { inputTokens: 1_000, outputTokens: 200, totalTokens: 1_200 },
      }),
    },
  );

  const result = await live.extract(year4SwimmingFixture.communication);
  const citation = result.claims[0]?.citations[0];

  expect(year4SwimmingFixture.communication.sourceText.slice(citation!.start, citation!.end)).toBe(
    citation!.quote,
  );
});
