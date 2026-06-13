import { createDigestWorkflow } from "./digest-workflow";
import { multiCommunicationScenario } from "./scenario";

export async function createDemoDigest(options: { completedResponsibilityIds?: string[] } = {}) {
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

  const completedResponsibilityIds = new Set(options.completedResponsibilityIds ?? []);
  const completed = result.digest.actNow.filter(
    (item) =>
      item.responsibilities.length > 0 &&
      item.responsibilities.every(({ id }) => completedResponsibilityIds.has(id)),
  );

  return {
    asOf: "2026-01-16",
    household: multiCommunicationScenario.household,
    digest: {
      ...result.digest,
      actNow: result.digest.actNow.filter((item) => !completed.includes(item)),
    },
    completed,
    communications: multiCommunicationScenario.extractions
      .map(({ communication }) => communication)
      .sort((left, right) => left.receivedAt.localeCompare(right.receivedAt)),
  };
}

export function isDemoResponsibilityId(responsibilityId: string) {
  return multiCommunicationScenario.extractions.some(({ responsibilities }) =>
    responsibilities.some(({ id }) => id === responsibilityId),
  );
}
