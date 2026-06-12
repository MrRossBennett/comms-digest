import { END, START, StateGraph, StateSchema } from "@langchain/langgraph";

import {
  modelExtractionSchema,
  schoolCommunicationSchema,
  validatedExtractionSchema,
  type ModelExtraction,
  type SchoolCommunication,
} from "./contracts";
import { validateAndIdentifyExtraction } from "./grounding";

const extractionStateSchema = new StateSchema({
  communication: schoolCommunicationSchema,
  extracted: modelExtractionSchema.optional(),
  validated: validatedExtractionSchema.optional(),
});

type Extractor = (communication: SchoolCommunication) => Promise<ModelExtraction>;

export function createExtractionWorkflow(options: { extract: Extractor; createId?: () => string }) {
  return new StateGraph(extractionStateSchema)
    .addNode("extract", async (state) => ({
      extracted: modelExtractionSchema.parse(await options.extract(state.communication)),
    }))
    .addNode("verify", (state) => {
      if (!state.extracted) {
        throw new Error("Extraction workflow reached verification without model output");
      }

      return {
        validated: validateAndIdentifyExtraction(
          state.communication,
          state.extracted,
          options.createId,
        ),
      };
    })
    .addEdge(START, "extract")
    .addEdge("extract", "verify")
    .addEdge("verify", END)
    .compile();
}
