import { END, START, StateGraph, StateSchema } from "@langchain/langgraph";
import { z } from "zod";

import { validatedExtractionSchema } from "./contracts";
import {
  composeDigest,
  digestSchema,
  householdDigestConfigSchema,
  reconciliationSchema,
} from "./digest";

const digestWorkflowStateSchema = new StateSchema({
  household: householdDigestConfigSchema,
  extractions: z.array(validatedExtractionSchema).min(1),
  reconciliation: reconciliationSchema.optional(),
  digest: digestSchema.optional(),
});

type Reconciler = (input: {
  household: z.infer<typeof householdDigestConfigSchema>;
  extractions: z.infer<typeof validatedExtractionSchema>[];
}) => Promise<unknown>;

export function createDigestWorkflow(options: { reconcile: Reconciler }) {
  return new StateGraph(digestWorkflowStateSchema)
    .addNode("reconcile", async (state) => ({
      reconciliation: reconciliationSchema.parse(
        await options.reconcile({
          household: state.household,
          extractions: state.extractions,
        }),
      ),
    }))
    .addNode("compose", (state) => {
      if (!state.reconciliation) {
        throw new Error("Digest workflow reached composition without reconciliation output");
      }

      return {
        digest: composeDigest({
          household: state.household,
          extractions: state.extractions,
          reconciliation: state.reconciliation,
        }),
      };
    })
    .addEdge(START, "reconcile")
    .addEdge("reconcile", "compose")
    .addEdge("compose", END)
    .compile();
}
