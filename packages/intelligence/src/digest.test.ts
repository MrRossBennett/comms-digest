import { expect, test } from "vite-plus/test";

import { composeDigest } from "./digest";
import { reconcileDigest } from "./reconcile";
import { multiCommunicationScenario } from "./scenario";

test("reconciles several School Communications into one household-specific Digest", () => {
  const digest = composeDigest(multiCommunicationScenario);

  expect(digest.actNow).toHaveLength(1);
  expect(digest.actNow[0]).toMatchObject({
    title: "Return Sam's museum trip permission form",
    childIds: ["018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c12"],
  });
  expect(digest.comingUp).toHaveLength(1);
  expect(digest.comingUp[0]).toMatchObject({
    title: "Sam's Year 6 museum trip",
    childIds: ["018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c12"],
  });
  expect(digest.goodToKnow).toHaveLength(2);
  expect(digest.goodToKnow[0]).toMatchObject({
    title: "Year 4 swimming has been cancelled",
    childIds: ["018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c01"],
  });
  expect(digest.goodToKnow[1]).toMatchObject({
    title: "Year 6 disco tickets are available",
    childIds: ["018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c12"],
  });
  expect(digest.goodToKnow[0]?.claims).toHaveLength(4);
  expect(digest.goodToKnow[0]?.responsibilities).toHaveLength(2);

  const surfacedClaims = [...digest.actNow, ...digest.comingUp, ...digest.goodToKnow].flatMap(
    (item) => item.claims,
  );
  expect(surfacedClaims.every((claim) => claim.citations.length > 0)).toBe(true);
  expect(surfacedClaims.some((claim) => claim.audience.originalWording === "Year 6")).toBe(true);
});

test("keeps School and group audiences inside the Communication's School", () => {
  const scenario = structuredClone(multiCommunicationScenario);
  const riversideId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97d01";
  const hillcrestId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97d02";

  scenario.household.children = [
    {
      id: scenario.household.children[0]!.id,
      name: "Alex",
      schoolYear: "Year 4",
      schoolId: riversideId,
    },
    {
      id: scenario.household.children[1]!.id,
      name: "Sam",
      schoolYear: "Year 6",
      schoolId: hillcrestId,
    },
    {
      id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97d03",
      name: "Jo",
      schoolYear: "Year 6",
      schoolId: riversideId,
    },
  ];

  for (const extraction of scenario.extractions) {
    extraction.communication.schoolId =
      extraction.communication.subject?.includes("Year 6") ||
      extraction.communication.subject?.includes("Museum")
        ? hillcrestId
        : riversideId;
  }

  const digest = composeDigest(scenario);
  const year6Item = digest.goodToKnow.find(({ title }) => title.includes("disco"));

  expect(year6Item?.childIds).toEqual([scenario.household.children[1]!.id]);
});

test("does not widen a Child-scoped Communication Source", () => {
  const scenario = structuredClone(multiCommunicationScenario);
  const schoolId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97d11";
  const samId = scenario.household.children[1]!.id;

  scenario.household.children = [
    {
      id: scenario.household.children[0]!.id,
      name: "Alex",
      schoolYear: "Year 4",
      schoolId,
    },
    {
      id: samId,
      name: "Sam",
      schoolYear: "Year 6",
      schoolId,
    },
    {
      id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97d12",
      name: "Jo",
      schoolYear: "Year 6",
      schoolId,
    },
  ];

  for (const extraction of scenario.extractions) {
    extraction.communication.schoolId = schoolId;
    extraction.communication.sourceChildIds = [samId];
  }

  const digest = composeDigest(scenario);
  const year6Item = digest.goodToKnow.find(({ title }) => title.includes("disco"));

  expect(year6Item?.childIds).toEqual([samId]);
});

test("does not reconcile matching topics across Schools", () => {
  const scenario = structuredClone(multiCommunicationScenario);
  const riversideId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97d21";
  const hillcrestId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97d22";

  scenario.household.children = [
    {
      id: scenario.household.children[0]!.id,
      name: "Alex",
      schoolYear: "Year 4",
      schoolId: riversideId,
    },
    {
      id: scenario.household.children[1]!.id,
      name: "Sam",
      schoolYear: "Year 6",
      schoolId: hillcrestId,
    },
  ];

  for (const extraction of scenario.extractions) {
    extraction.communication.schoolId = extraction.communication.subject?.includes("cancelled")
      ? hillcrestId
      : riversideId;
  }

  const reconciliation = reconcileDigest({
    household: scenario.household,
    extractions: scenario.extractions,
  });

  expect(
    reconciliation.items.some(
      ({ section, title }) => section === "act_now" && title.includes("Pay £12"),
    ),
  ).toBe(true);
});

test("fails closed when reconciliation references an unknown Claim", () => {
  const scenario = structuredClone(multiCommunicationScenario);
  scenario.reconciliation.items[0]!.claimIds = ["018f1f5e-7b5a-7cc0-9d26-7f4f6fc97cff"];

  expect(() => composeDigest(scenario)).toThrow("unknown Claim");
});
