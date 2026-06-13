import { createRecordedCorpusExtractor, extractCorpus } from "./corpus-pipeline";
import { demoCorpus, demoHousehold } from "./demo-corpus";
import { createDigestWorkflow } from "./digest-workflow";
import { reconcileDigest } from "./reconcile";

export async function createDemoDigest(options: { completedResponsibilityIds?: string[] } = {}) {
  const extractions = await extractCorpus(demoCorpus, createRecordedCorpusExtractor(demoCorpus));
  const workflow = createDigestWorkflow({
    reconcile: async (input) => reconcileDigest(input),
  });
  const result = await workflow.invoke({
    household: demoHousehold,
    extractions,
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
    household: demoHousehold,
    digest: {
      ...result.digest,
      actNow: result.digest.actNow.filter((item) => !completed.includes(item)),
    },
    completed,
    communications: extractions
      .map(({ communication }) => communication)
      .sort((left, right) => left.receivedAt.localeCompare(right.receivedAt)),
  };
}

export async function isDemoResponsibilityId(responsibilityId: string) {
  const extractions = await extractCorpus(demoCorpus, createRecordedCorpusExtractor(demoCorpus));
  return extractions.some(({ responsibilities }) =>
    responsibilities.some(({ id }) => id === responsibilityId),
  );
}
