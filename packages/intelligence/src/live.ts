import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { z } from "zod";

import { modelExtractionSchema, type ModelExtraction, type SchoolCommunication } from "./contracts";
import { alignExtractionCitations } from "./grounding";

export const MAX_EXTRACTION_OUTPUT_TOKENS = 2_000;

export const liveModelConfigSchema = z.object({
  provider: z.literal("anthropic").default("anthropic"),
  modelId: z.string().min(1).default("claude-haiku-4-5-20251001"),
  promptVersion: z.string().min(1).default("school-extraction-v4"),
  maxOutputTokens: z.int().positive().default(MAX_EXTRACTION_OUTPUT_TOKENS),
  apiKey: z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional()),
});

const generationUsageSchema = z.object({
  inputTokens: z.number().nonnegative().optional(),
  outputTokens: z.number().nonnegative().optional(),
  totalTokens: z.number().nonnegative().optional(),
});

const generationResultSchema = z.object({
  output: modelExtractionSchema,
  usage: generationUsageSchema,
});

type GenerationRequest = {
  communication: SchoolCommunication;
  modelId: string;
  maxOutputTokens: number;
  apiKey?: string;
};

type GenerateStructured = (request: GenerationRequest) => Promise<unknown>;

type LiveRunMetadata = {
  provider: "anthropic";
  modelId: string;
  promptVersion: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

const extractionInstructions = `Extract grounded school Claims and Household Owner Responsibilities.
Return no identifiers. Responsibilities must reference zero-based Claim positions.
Every Claim needs one or more Citations. A Citation quote must be an exact substring of sourceText, and its start and end must be zero-based character offsets such that sourceText.slice(start, end) equals the quote exactly.

A Claim represents a meaningful piece of information — an activity, a payment, an event. A bare date phrase is not a Claim on its own. When a Claim's activity or event has a date, always populate the Claim's date field with the original wording and the resolved date.
Claim content is a concise synthesized statement in plain language. Embed resolved dates in the content where relevant (e.g. "Year 4 swimming lessons start on 19 January 2026.").

Audience scope: use "child" for a named child, "group" for a year group or class, "school" for the whole school, "household" for all household members, "unresolved" when genuinely unclear. Preserve the original wording in originalWording separately.
Preserve the original relative-date wording in date fields.
Resolve each date to an ISO date (YYYY-MM-DD) relative to the received date stated below, in the household timezone. "next <weekday>" means that weekday in the following week, never the same week. Use null when the wording is genuinely ambiguous.
Do not invent information that is not supported by an exact Citation.`;

function buildPrompt(communication: SchoolCommunication) {
  const receivedOn = new Intl.DateTimeFormat("en-GB", {
    timeZone: communication.householdTimezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(communication.receivedAt));

  return `${extractionInstructions}

This communication was received on ${receivedOn} (${communication.householdTimezone}). Resolve every relative date relative to that date.

School Communication:
${JSON.stringify(communication, null, 2)}`;
}

async function generateWithAiSdk(request: GenerationRequest) {
  const anthropic = createAnthropic({ apiKey: request.apiKey });
  const result = await generateText({
    model: anthropic(request.modelId),
    output: Output.object({
      schema: modelExtractionSchema,
      name: "schoolCommunicationExtraction",
      description: "Grounded Claims and Responsibilities from one School Communication",
    }),
    prompt: buildPrompt(request.communication),
    temperature: 0,
    maxOutputTokens: request.maxOutputTokens,
  });

  return {
    output: result.output,
    usage: {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens,
    },
  };
}

export function createLiveExtractor(
  configInput: z.input<typeof liveModelConfigSchema>,
  dependencies: { generate?: GenerateStructured } = {},
) {
  const config = liveModelConfigSchema.parse(configInput);
  const generate = dependencies.generate ?? generateWithAiSdk;
  let lastRunMetadata: LiveRunMetadata | undefined;

  return {
    extract: async (communication: SchoolCommunication): Promise<ModelExtraction> => {
      const startedAt = performance.now();
      const result = generationResultSchema.parse(
        await generate({
          communication,
          modelId: config.modelId,
          maxOutputTokens: config.maxOutputTokens,
          apiKey: config.apiKey,
        }),
      );
      const inputTokens = result.usage.inputTokens ?? 0;
      const outputTokens = result.usage.outputTokens ?? 0;
      const extraction = alignExtractionCitations(communication.sourceText, result.output);

      lastRunMetadata = {
        provider: config.provider,
        modelId: config.modelId,
        promptVersion: config.promptVersion,
        latencyMs: performance.now() - startedAt,
        inputTokens,
        outputTokens,
        totalTokens: result.usage.totalTokens ?? inputTokens + outputTokens,
        estimatedCostUsd: (inputTokens + outputTokens * 5) / 1_000_000,
      };

      return extraction;
    },
    getLastRunMetadata: () => {
      if (!lastRunMetadata) {
        throw new Error("No live extraction has completed");
      }
      return lastRunMetadata;
    },
  };
}
