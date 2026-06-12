import { expect, test } from "vite-plus/test";

import { modelExtractionSchema, schoolCommunicationSchema } from "./contracts";
import { year4SwimmingFixture } from "./fixtures";

test("keeps the Year 4 swimming input and human-authored ground truth contract-valid", () => {
  expect(() => schoolCommunicationSchema.parse(year4SwimmingFixture.communication)).not.toThrow();
  expect(() => modelExtractionSchema.parse(year4SwimmingFixture.expected)).not.toThrow();
  expect(year4SwimmingFixture.expected.claims.length).toBeGreaterThanOrEqual(2);
  expect(year4SwimmingFixture.expected.responsibilities.length).toBeGreaterThanOrEqual(1);
});
