import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { z } from "zod";

import { modelExtractionSchema, type ModelExtraction, type SchoolCommunication } from "./contracts";

export const liveModelConfigSchema = z.object({
  provider: z.literal("anthropic").default("anthropic"),
  modelId: z.string().min(1).default("claude-haiku-4-5-20251001"),
  promptVersion: z.string().min(1).default("school-extraction-v1"),
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
Every Claim must include exact Citation quotes and JavaScript string start/end offsets.
Preserve original Audience and relative-date wording.
Resolve dates from receivedAt in householdTimezone. Use null when wording is ambiguous.
Do not invent information that is not supported by an exact Citation.`;

function buildPrompt(communication: SchoolCommunication) {
  return `${extractionInstructions}

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
          apiKey: config.apiKey,
        }),
      );
      const inputTokens = result.usage.inputTokens ?? 0;
      const outputTokens = result.usage.outputTokens ?? 0;

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

      return result.output;
    },
    getLastRunMetadata: () => {
      if (!lastRunMetadata) {
        throw new Error("No live extraction has completed");
      }
      return lastRunMetadata;
    },
  };
}
