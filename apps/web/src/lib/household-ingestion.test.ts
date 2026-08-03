import { describe, expect, test } from "vite-plus/test";

import { filterNewCandidates } from "./household-ingestion";

const candidate = (externalMessageId: string) => ({ externalMessageId });

describe("filterNewCandidates", () => {
  test("returns no candidates when the input is empty", () => {
    expect(filterNewCandidates([], [])).toEqual([]);
  });

  test("returns no candidates when every candidate has been seen", () => {
    expect(filterNewCandidates([candidate("one"), candidate("two")], ["one", "two"])).toEqual([]);
  });

  test("returns every candidate when none have been seen", () => {
    const candidates = [candidate("one"), candidate("two")];
    expect(filterNewCandidates(candidates, [])).toEqual(candidates);
  });

  test("returns only candidates that have not been seen", () => {
    const newCandidate = candidate("two");
    expect(filterNewCandidates([candidate("one"), newCandidate], ["one"])).toEqual([newCandidate]);
  });
});
