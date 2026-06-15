import { expect, test } from "vite-plus/test";

import { formatRoutineSchedule, nextRoutineOccurrence } from "./routine";

test("finds today's routine occurrence", () => {
  expect(nextRoutineOccurrence({ weekdays: [1, 4] }, "2026-06-15")).toBe("2026-06-15");
});

test("finds the next selected weekday", () => {
  expect(nextRoutineOccurrence({ weekdays: [2, 4] }, "2026-06-15")).toBe("2026-06-16");
});

test("respects routine start and end dates", () => {
  expect(
    nextRoutineOccurrence(
      { weekdays: [2], startDate: "2026-06-23", endDate: "2026-06-30" },
      "2026-06-15",
    ),
  ).toBe("2026-06-23");
  expect(
    nextRoutineOccurrence({ weekdays: [2], endDate: "2026-06-14" }, "2026-06-15"),
  ).toBeUndefined();
});

test("formats selected weekdays for people", () => {
  expect(formatRoutineSchedule([2, 4])).toBe("Tuesday and Thursday");
});
