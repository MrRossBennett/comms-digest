import { expect, test } from "vite-plus/test";

import { composeDigest } from "./digest";
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

test("fails closed when reconciliation references an unknown Claim", () => {
  const scenario = structuredClone(multiCommunicationScenario);
  scenario.reconciliation.items[0]!.claimIds = ["018f1f5e-7b5a-7cc0-9d26-7f4f6fc97cff"];

  expect(() => composeDigest(scenario)).toThrow("unknown Claim");
});
