import { z } from "zod";

import { validatedExtractionSchema } from "./contracts";
import { householdDigestConfigSchema, reconciliationSchema } from "./digest";

const reconcileInputSchema = z
  .object({
    household: householdDigestConfigSchema,
    extractions: z.array(validatedExtractionSchema).min(1),
  })
  .strict();

const ignoredTopicWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "available",
  "be",
  "been",
  "by",
  "for",
  "families",
  "has",
  "is",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "now",
  "of",
  "on",
  "pay",
  "payment",
  "please",
  "remains",
  "return",
  "starts",
  "the",
  "to",
  "will",
  "year",
]);

function topicWords(value: string) {
  return new Set(
    value
      .toLocaleLowerCase("en-GB")
      .replaceAll(/[^a-z0-9£]+/g, " ")
      .split(" ")
      .filter((word) => word.length > 2 && !/^\d+$/.test(word) && !ignoredTopicWords.has(word)),
  );
}

function sharesTopic(left: string, right: string) {
  const leftWords = topicWords(left);
  return [...topicWords(right)].some((word) => leftWords.has(word));
}

function withoutFullStop(value: string) {
  return value.endsWith(".") ? value.slice(0, -1) : value;
}

function cancellationTitle(value: string) {
  return withoutFullStop(
    value.replace(/\s+on\s+\d{1,2}\s+[a-z]+\s+\d{4}\s+has been cancelled/iu, " has been cancelled"),
  );
}

export function reconcileDigest(input: unknown) {
  const { extractions } = reconcileInputSchema.parse(input);
  const claims = extractions.flatMap(({ claims }) => claims);
  const responsibilities = extractions.flatMap(({ responsibilities }) => responsibilities);
  const communicationByClaimId = new Map(
    extractions.flatMap(({ communication, claims: communicationClaims }) =>
      communicationClaims.map((claim) => [claim.id, communication]),
    ),
  );
  const schoolIdByClaimId = new Map(
    extractions.flatMap(({ communication, claims: communicationClaims }) =>
      communicationClaims.map((claim) => [claim.id, communication.schoolId ?? null]),
    ),
  );
  const schoolIdByResponsibilityId = new Map(
    responsibilities.map((responsibility) => {
      const firstClaimId = responsibility.supportingClaimIds[0];
      return [
        responsibility.id,
        firstClaimId ? (schoolIdByClaimId.get(firstClaimId) ?? null) : null,
      ];
    }),
  );
  const consumedClaimIds = new Set<string>();
  const consumedResponsibilityIds = new Set<string>();
  const items: Array<{
    section: "act_now" | "coming_up" | "good_to_know";
    title: string;
    claimIds: string[];
    responsibilityIds: string[];
  }> = [];

  for (const cancellation of claims.filter((claim) => /\bcancelled\b/i.test(claim.content))) {
    const cancellationSchoolId = schoolIdByClaimId.get(cancellation.id) ?? null;
    const relatedClaims = claims.filter(
      (claim) =>
        (schoolIdByClaimId.get(claim.id) ?? null) === cancellationSchoolId &&
        sharesTopic(cancellation.content, claim.content),
    );
    const relatedResponsibilities = responsibilities.filter(
      (responsibility) =>
        (schoolIdByResponsibilityId.get(responsibility.id) ?? null) === cancellationSchoolId &&
        sharesTopic(cancellation.content, responsibility.title),
    );

    relatedClaims.forEach(({ id }) => consumedClaimIds.add(id));
    relatedResponsibilities.forEach(({ id }) => consumedResponsibilityIds.add(id));
    items.push({
      section: "good_to_know",
      title: cancellationTitle(cancellation.content),
      claimIds: relatedClaims.map(({ id }) => id),
      responsibilityIds: relatedResponsibilities.map(({ id }) => id),
    });
  }

  const activeResponsibilities = responsibilities.filter(
    ({ id }) => !consumedResponsibilityIds.has(id),
  );
  const responsibilitiesByTitle = new Map<string, typeof activeResponsibilities>();
  for (const responsibility of activeResponsibilities) {
    const key = `${schoolIdByResponsibilityId.get(responsibility.id) ?? "household"}:${responsibility.title.toLocaleLowerCase("en-GB")}`;
    responsibilitiesByTitle.set(key, [...(responsibilitiesByTitle.get(key) ?? []), responsibility]);
  }

  for (const matchingResponsibilities of responsibilitiesByTitle.values()) {
    const supportingClaimIds = [
      ...new Set(matchingResponsibilities.flatMap(({ supportingClaimIds }) => supportingClaimIds)),
    ];
    supportingClaimIds.forEach((id) => consumedClaimIds.add(id));
    matchingResponsibilities.forEach(({ id }) => consumedResponsibilityIds.add(id));
    items.push({
      section: "act_now",
      title: matchingResponsibilities[0]!.title,
      claimIds: supportingClaimIds,
      responsibilityIds: matchingResponsibilities.map(({ id }) => id),
    });
  }

  for (const claim of claims.filter(({ id }) => !consumedClaimIds.has(id))) {
    const communication = communicationByClaimId.get(claim.id);
    if (!communication) {
      throw new Error(`Claim ${claim.id} has no School Communication`);
    }

    items.push({
      section: claim.date ? "coming_up" : "good_to_know",
      title: withoutFullStop(claim.content),
      claimIds: [claim.id],
      responsibilityIds: [],
    });
  }

  return reconciliationSchema.parse({ items });
}
