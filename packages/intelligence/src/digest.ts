import { z } from "zod";

import { claimSchema, responsibilitySchema, validatedExtractionSchema } from "./contracts";

const childSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1),
    schoolYear: z.string().min(1),
  })
  .strict();

export const householdDigestConfigSchema = z
  .object({
    children: z.array(childSchema).min(1),
  })
  .strict();

export const reconciliationItemSchema = z
  .object({
    section: z.enum(["act_now", "coming_up", "good_to_know"]),
    title: z.string().min(1),
    claimIds: z.array(z.uuid()).min(1),
    responsibilityIds: z.array(z.uuid()),
  })
  .strict();

export const reconciliationSchema = z
  .object({
    items: z.array(reconciliationItemSchema),
  })
  .strict();

const digestItemSchema = z
  .object({
    title: z.string().min(1),
    childIds: z.array(z.uuid()).min(1),
    claims: z.array(claimSchema).min(1),
    responsibilities: z.array(responsibilitySchema),
  })
  .strict();

export const digestSchema = z
  .object({
    actNow: z.array(digestItemSchema),
    comingUp: z.array(digestItemSchema),
    goodToKnow: z.array(digestItemSchema),
  })
  .strict();

const composeDigestInputSchema = z
  .object({
    household: householdDigestConfigSchema,
    extractions: z.array(validatedExtractionSchema).min(1),
    reconciliation: reconciliationSchema,
  })
  .strict();

function relevantChildIds(
  audience: z.infer<typeof claimSchema>["audience"],
  household: z.infer<typeof householdDigestConfigSchema>,
) {
  if (audience.scope === "school" || audience.scope === "household") {
    return household.children.map(({ id }) => id);
  }

  const wording = audience.originalWording.toLocaleLowerCase("en-GB");

  return household.children
    .filter((child) => {
      if (audience.scope === "child") {
        return wording.includes(child.name.toLocaleLowerCase("en-GB"));
      }
      if (audience.scope === "group") {
        return wording.includes(child.schoolYear.toLocaleLowerCase("en-GB"));
      }
      return false;
    })
    .map(({ id }) => id);
}

export function composeDigest(input: unknown) {
  const { household, extractions, reconciliation } = composeDigestInputSchema.parse(input);
  const claims = new Map(
    extractions.flatMap(({ claims }) => claims).map((claim) => [claim.id, claim]),
  );
  const responsibilities = new Map(
    extractions
      .flatMap(({ responsibilities }) => responsibilities)
      .map((responsibility) => [responsibility.id, responsibility]),
  );

  const items = reconciliation.items.flatMap((item) => {
    const itemClaims = item.claimIds.map((claimId) => {
      const claim = claims.get(claimId);
      if (!claim) {
        throw new Error(`Reconciliation references unknown Claim ${claimId}`);
      }
      return claim;
    });
    const childIds = [
      ...new Set(itemClaims.flatMap((claim) => relevantChildIds(claim.audience, household))),
    ];

    if (childIds.length === 0) {
      return [];
    }

    const itemResponsibilities = item.responsibilityIds.map((responsibilityId) => {
      const responsibility = responsibilities.get(responsibilityId);
      if (!responsibility) {
        throw new Error(`Reconciliation references unknown Responsibility ${responsibilityId}`);
      }
      if (!responsibility.supportingClaimIds.some((claimId) => item.claimIds.includes(claimId))) {
        throw new Error(
          `Responsibility ${responsibilityId} is not supported by this Digest item's Claims`,
        );
      }
      return responsibility;
    });

    return [
      {
        section: item.section,
        digestItem: digestItemSchema.parse({
          title: item.title,
          childIds,
          claims: itemClaims,
          responsibilities: itemResponsibilities,
        }),
      },
    ];
  });

  return digestSchema.parse({
    actNow: items
      .filter(({ section }) => section === "act_now")
      .map(({ digestItem }) => digestItem),
    comingUp: items
      .filter(({ section }) => section === "coming_up")
      .map(({ digestItem }) => digestItem),
    goodToKnow: items
      .filter(({ section }) => section === "good_to_know")
      .map(({ digestItem }) => digestItem),
  });
}
