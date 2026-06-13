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

test("builds the Household Digest from the full corpus while excluding irrelevant audiences", async () => {
  const demo = await createDemoDigest();
  const surfacedTitles = [
    ...demo.digest.actNow,
    ...demo.digest.comingUp,
    ...demo.digest.goodToKnow,
  ].map(({ title }) => title);

  expect(demo.communications).toHaveLength(6);
  expect(demo.communications.some(({ subject }) => subject === "Year 2 bake sale")).toBe(true);
  expect(surfacedTitles).not.toContain("Year 2 bake sale is on Friday");
});

test("reconciles reminders and cancellation before composing the Digest", async () => {
  const demo = await createDemoDigest();
  const swimming = demo.digest.goodToKnow.find(
    ({ title }) => title === "Year 4 swimming has been cancelled",
  );

  expect(demo.digest.actNow).toHaveLength(1);
  expect(demo.digest.actNow[0]?.title).toBe("Return Sam's museum trip permission form");
  expect(demo.digest.comingUp).toHaveLength(1);
  expect(demo.digest.comingUp[0]?.title).toBe("Year 6 Science Museum trip");
  expect(swimming?.claims).toHaveLength(4);
  expect(swimming?.responsibilities).toHaveLength(2);
  expect(demo.digest.actNow.some(({ title }) => title.includes("swimming"))).toBe(false);
});

test("keeps grounded identifiers and Citations stable across repeated pipeline runs", async () => {
  const first = await createDemoDigest();
  const second = await createDemoDigest();
  const firstResponsibility = first.digest.actNow[0]?.responsibilities[0];
  const secondResponsibility = second.digest.actNow[0]?.responsibilities[0];

  expect(firstResponsibility?.id).toBe(secondResponsibility?.id);

  for (const item of [
    ...first.digest.actNow,
    ...first.digest.comingUp,
    ...first.digest.goodToKnow,
  ]) {
    for (const claim of item.claims) {
      for (const citation of claim.citations) {
        const communication = first.communications.find(
          ({ id }) => id === citation.communicationId,
        );
        expect(communication?.sourceText.slice(citation.start, citation.end)).toBe(citation.quote);
      }
    }
  }
});
