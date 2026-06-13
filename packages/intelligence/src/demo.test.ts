import { expect, test } from "vite-plus/test";

import { createDemoDigest } from "./demo";

test("completed Responsibilities leave Act Now without removing related Coming Up items", async () => {
  const unresolved = await createDemoDigest();
  const responsibilityId = unresolved.digest.actNow[0]?.responsibilities[0]?.id;

  expect(responsibilityId).toBeDefined();
  expect(unresolved.digest.actNow).toHaveLength(1);
  expect(unresolved.completed).toEqual([]);

  const completed = await createDemoDigest({
    completedResponsibilityIds: [responsibilityId!],
  });

  expect(completed.digest.actNow).toEqual([]);
  expect(completed.completed).toHaveLength(1);
  expect(completed.completed[0]?.title).toBe("Return Sam's museum trip permission form");
  expect(completed.digest.comingUp).toHaveLength(1);
});
