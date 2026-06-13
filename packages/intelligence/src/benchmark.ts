import { z } from "zod";

import { validatedExtractionSchema } from "./contracts";
import { digestSchema, householdDigestConfigSchema, reconciliationSchema } from "./digest";
import { createDigestWorkflow } from "./digest-workflow";

const expectedDigestItemSchema = z
  .object({
    section: z.enum(["act_now", "coming_up", "good_to_know"]),
    title: z.string().min(1),
    childIds: z.array(z.uuid()).min(1),
  })
  .strict();

export const digestGroundTruthSchema = z
  .object({
    items: z.array(expectedDigestItemSchema),
  })
  .strict();

const digestBenchmarkInputSchema = z
  .object({
    scenario: z.object({
      household: householdDigestConfigSchema,
      extractions: z.array(validatedExtractionSchema).min(1),
    }),
    expected: digestGroundTruthSchema,
    naive: digestSchema,
  })
  .strict();

function digestItems(digestInput: unknown) {
  const digest = digestSchema.parse(digestInput);
  const withSection = (
    section: "act_now" | "coming_up" | "good_to_know",
    items: typeof digest.actNow,
  ) => items.map((item) => ({ ...item, section }));

  return [
    ...withSection("act_now", digest.actNow),
    ...withSection("coming_up", digest.comingUp),
    ...withSection("good_to_know", digest.goodToKnow),
  ];
}

function itemKey(item: { section: string; title: string }) {
  return `${item.section}:${item.title}`;
}

export function scoreDigest(expectedInput: unknown, actualInput: unknown) {
  const expected = digestGroundTruthSchema.parse(expectedInput);
  const actual = digestItems(actualInput);
  const expectedByKey = new Map(expected.items.map((item) => [itemKey(item), item]));
  const actualKeys = new Set(actual.map(itemKey));
  const matchedItems = actual.filter((item) => expectedByKey.has(itemKey(item)));
  const precision = actual.length === 0 ? 0 : matchedItems.length / actual.length;
  const recall =
    expected.items.length === 0
      ? 1
      : expected.items.filter((item) => actualKeys.has(itemKey(item))).length /
        expected.items.length;
  const routingAccuracy =
    matchedItems.length === 0
      ? 0
      : matchedItems.filter((item) => {
          const expectedItem = expectedByKey.get(itemKey(item));
          return (
            expectedItem &&
            JSON.stringify([...item.childIds].sort()) ===
              JSON.stringify([...expectedItem.childIds].sort())
          );
        }).length / matchedItems.length;
  const citationCoverage =
    actual.length === 0
      ? 0
      : actual.filter((item) =>
          item.claims.every(
            (claim) =>
              claim.citations.length > 0 &&
              claim.citations.every(({ quote }) => quote.trim().length > 0),
          ),
        ).length / actual.length;
  const hallucinationRate = actual.length === 0 ? 0 : 1 - precision;
  const overall = (precision + recall + routingAccuracy + citationCoverage) / 4;

  return {
    precision,
    recall,
    routingAccuracy,
    citationCoverage,
    hallucinationRate,
    overall,
  };
}

export async function runDigestBenchmark(
  input: unknown,
  reconcile: (input: {
    household: z.infer<typeof householdDigestConfigSchema>;
    extractions: z.infer<typeof validatedExtractionSchema>[];
  }) => Promise<unknown>,
) {
  const benchmark = digestBenchmarkInputSchema.parse(input);
  const workflow = createDigestWorkflow({
    reconcile: async (scenario) => reconciliationSchema.parse(await reconcile(scenario)),
  });
  const result = await workflow.invoke(benchmark.scenario);
  if (!result.digest) {
    throw new Error("Digest benchmark pipeline completed without a Digest");
  }

  const pipelineDigest = result.digest;
  const pipeline = scoreDigest(benchmark.expected, pipelineDigest);
  const naive = scoreDigest(benchmark.expected, benchmark.naive);

  return {
    pipeline,
    naive,
    delta: pipeline.overall - naive.overall,
  };
}
