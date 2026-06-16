import { expect, test } from "vite-plus/test";

import { resolveRelativeDate, todayInTimezone } from "./dates";

const receivedAt = "2026-06-14T09:00:00.000Z";
const timezone = "Europe/London";

test.each([
  ["this Monday 15th June", "2026-06-15"],
  ["next Wednesday 17th June", "2026-06-17"],
  ["Tuesday 16th June", "2026-06-16"],
  ["Monday 15 June", "2026-06-15"],
  ["15th June", "2026-06-15"],
  ["15/06/2026", "2026-06-15"],
  ["tomorrow", "2026-06-15"],
  ["next Monday", "2026-06-15"],
  ["this Monday", "2026-06-15"],
  ["Monday", "2026-06-15"],
])('resolves UK school date wording "%s"', (wording, resolvedDate) => {
  expect(resolveRelativeDate(wording, receivedAt, timezone)).toEqual({
    originalWording: wording,
    resolvedDate,
  });
});

test("uses the School Communication timestamp in the Household timezone", () => {
  expect(resolveRelativeDate("tomorrow", "2026-06-14T23:30:00.000Z", "Europe/London")).toEqual({
    originalWording: "tomorrow",
    resolvedDate: "2026-06-16",
  });
});

test.each([
  "near the end of term",
  "Wednesday 18th June",
  "Monday and Tuesday",
  "Please return this Monday",
])('preserves unverifiable date wording "%s" without guessing', (wording) => {
  expect(resolveRelativeDate(wording, receivedAt, timezone)).toEqual({
    originalWording: wording,
    resolvedDate: null,
  });
});

test("rolls over at local midnight rather than UTC midnight during BST", () => {
  expect(todayInTimezone("Europe/London", new Date("2026-06-14T23:30:00.000Z"))).toBe("2026-06-15");
});

test("matches the UTC date in GMT, where there is no offset", () => {
  expect(todayInTimezone("Europe/London", new Date("2026-01-14T23:30:00.000Z"))).toBe("2026-01-14");
});
