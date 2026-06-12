import { expect, test } from "vite-plus/test";

import { resolveRelativeDate } from "./dates";

test("resolves weekday wording from the School Communication timestamp and Household timezone", () => {
  expect(resolveRelativeDate("Friday", "2026-01-12T23:30:00.000Z", "Europe/London")).toEqual({
    originalWording: "Friday",
    resolvedDate: "2026-01-16",
  });

  expect(resolveRelativeDate("next Monday", "2026-01-12T23:30:00.000Z", "Europe/London")).toEqual({
    originalWording: "next Monday",
    resolvedDate: "2026-01-19",
  });
});

test("preserves ambiguous date wording without guessing a date", () => {
  expect(
    resolveRelativeDate("near the end of term", "2026-01-12T23:30:00.000Z", "Europe/London"),
  ).toEqual({
    originalWording: "near the end of term",
    resolvedDate: null,
  });
});

test("resolves a stated day and month using the communication year", () => {
  expect(
    resolveRelativeDate("Monday 19 January", "2026-01-12T23:30:00.000Z", "Europe/London"),
  ).toEqual({
    originalWording: "Monday 19 January",
    resolvedDate: "2026-01-19",
  });
});
