import { createDigestWorkflow } from "./digest-workflow";
import { multiCommunicationScenario } from "./scenario";

export async function createDemoDigest() {
  const workflow = createDigestWorkflow({
    reconcile: async () => multiCommunicationScenario.reconciliation,
  });
  const result = await workflow.invoke({
    household: multiCommunicationScenario.household,
    extractions: multiCommunicationScenario.extractions,
  });

  if (!result.digest) {
    throw new Error("Demo Digest workflow completed without a Digest");
  }

  return {
    asOf: "2026-01-15",
    household: multiCommunicationScenario.household,
    digest: result.digest,
    communications: multiCommunicationScenario.extractions
      .map(({ communication }) => communication)
      .sort((left, right) => left.receivedAt.localeCompare(right.receivedAt)),
  };
}
