import { expect, test } from "vite-plus/test";

import { composeDigest } from "./digest";
import { multiCommunicationScenario } from "./scenario";

test("reconciles several School Communications into one household-specific Digest", () => {
  const digest = composeDigest(multiCommunicationScenario);

  expect(digest.actNow).toHaveLength(1);
  expect(digest.actNow[0]).toMatchObject({
    title: "Pay £12 for Year 4 swimming",
    childIds: ["018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c01"],
  });
  expect(digest.actNow[0]?.claims).toHaveLength(2);

  expect(digest.comingUp).toEqual([]);
  expect(digest.goodToKnow).toHaveLength(1);
  expect(digest.goodToKnow[0]).toMatchObject({
    title: "Year 4 swimming has been cancelled",
    childIds: ["018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c01"],
  });

  const surfacedClaims = [...digest.actNow, ...digest.comingUp, ...digest.goodToKnow].flatMap(
    (item) => item.claims,
  );
  expect(surfacedClaims.every((claim) => claim.citations.length > 0)).toBe(true);
  expect(surfacedClaims.some((claim) => claim.audience.originalWording === "Year 6")).toBe(false);
});

test("fails closed when reconciliation references an unknown Claim", () => {
  const scenario = structuredClone(multiCommunicationScenario);
  scenario.reconciliation.items[0]!.claimIds = ["018f1f5e-7b5a-7cc0-9d26-7f4f6fc97cff"];

  expect(() => composeDigest(scenario)).toThrow("unknown Claim");
});
