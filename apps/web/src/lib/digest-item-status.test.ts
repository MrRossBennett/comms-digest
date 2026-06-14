import { expect, test } from "vite-plus/test";

import { digestEvidenceKey, isDigestItemDismissed } from "./digest-item-status";

const item = {
  title: "Return the permission form",
  childIds: ["018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b10"],
  claims: [
    { id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b01" },
    { id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b02" },
  ],
  responsibilities: [{ id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b03" }],
};

test("uses sorted Claim IDs as the stable Digest evidence key", () => {
  expect(digestEvidenceKey(item.claims.map(({ id }) => id).reverse())).toBe(
    "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b01:018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b02",
  );
});

test("requires every underlying Claim and Responsibility to remain dismissed", () => {
  expect(
    isDigestItemDismissed(
      item,
      new Set(item.claims.map(({ id }) => id)),
      new Set(item.responsibilities.map(({ id }) => id)),
    ),
  ).toBe(true);

  expect(
    isDigestItemDismissed(
      item,
      new Set([item.claims[0]!.id]),
      new Set(item.responsibilities.map(({ id }) => id)),
    ),
  ).toBe(false);
});
