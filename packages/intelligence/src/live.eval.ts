import { BraintrustLangChainCallbackHandler, Eval } from "braintrust";

import { scoreExtraction } from "./evaluation";
import { year4SwimmingFixture } from "./fixtures";
import { createLiveExtractor } from "./live";
import { createExtractionWorkflow } from "./workflow";

const live = createLiveExtractor({
  provider: "anthropic",
  modelId: process.env.INTELLIGENCE_MODEL_ID ?? "claude-haiku-4-5-20251001",
  promptVersion: process.env.INTELLIGENCE_PROMPT_VERSION ?? "school-extraction-v2",
  apiKey: process.env.ANTHROPIC_API_KEY,
});
const workflow = createExtractionWorkflow({ extract: live.extract });

Eval("Comms Digest", {
  experimentName: "year-4-swimming-tracer-bullet",
  description: "Live Claude Haiku 4.5 baseline for grounded School Communication extraction",
  data: [
    {
      input: year4SwimmingFixture.communication,
      expected: year4SwimmingFixture.expected,
      metadata: { synthetic: true, scenario: "year-4-swimming" },
    },
  ],
  task: async (communication, hooks) => {
    const result = await workflow.invoke(
      { communication },
      {
        callbacks: [
          new BraintrustLangChainCallbackHandler({
            parent: hooks.span,
          }),
        ],
      },
    );
    if (!result.extracted || !result.validated) {
      throw new Error("Live extraction workflow completed without validated output");
    }

    Object.assign(hooks.metadata, live.getLastRunMetadata());
    return result.extracted;
  },
  scores: [
    function claims({ expected, output }) {
      return scoreExtraction(expected, output).claims;
    },
    function responsibilities({ expected, output }) {
      return scoreExtraction(expected, output).responsibilities;
    },
    function dates({ expected, output }) {
      return scoreExtraction(expected, output).dates;
    },
    function amounts({ expected, output }) {
      return scoreExtraction(expected, output).amounts;
    },
    function audience({ expected, output }) {
      return scoreExtraction(expected, output).audience;
    },
    function citations({ expected, output }) {
      return scoreExtraction(expected, output).citations;
    },
    function overall({ expected, output }) {
      return scoreExtraction(expected, output).overall;
    },
  ],
  metadata: {
    provider: "anthropic",
    modelId: process.env.INTELLIGENCE_MODEL_ID ?? "claude-haiku-4-5-20251001",
    promptVersion: process.env.INTELLIGENCE_PROMPT_VERSION ?? "school-extraction-v2",
    fixture: "year-4-swimming",
  },
  tags: ["synthetic", "tracer-bullet"],
});
