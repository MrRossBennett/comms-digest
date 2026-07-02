import { describe, expect, test } from "vite-plus/test";

import type { DayPlan, DayPlanEntry } from "./day-plan";
import { composeDayPlanMessage, gsm7Units } from "./day-plan-message";

const link = "https://comms.example/app?date=2026-07-03";

describe("composeDayPlanMessage", () => {
  test("always keeps a large plan inside one GSM-7 segment with its deep link", () => {
    const longEntry = entry(
      "Alexandria-Cassandra's extraordinarily long swimming equipment checklist",
    );
    const plan = dayPlan({
      today: Array.from({ length: 20 }, () => longEntry),
      comingUp: Array.from({ length: 20 }, () => longEntry),
    });

    const result = composeDayPlanMessage(plan, link);

    expect(result.outcome).toBe("composed");
    if (result.outcome !== "composed") return;
    expect(result.body).toContain(link);
    expect(gsm7Units(result.body)).toBeLessThanOrEqual(160);
    expect(result.segmentUnits).toBe(gsm7Units(result.body));
  });

  test("strips emoji and non-GSM characters instead of creating a Unicode segment", () => {
    const result = composeDayPlanMessage(
      dayPlan({ today: [entry("Bring kit 🏊 tomorrow")] }),
      link,
    );

    expect(result.outcome).toBe("composed");
    if (result.outcome !== "composed") return;
    expect(result.body).not.toContain("🏊");
    expect(gsm7Units(result.body)).toBeLessThanOrEqual(160);
  });

  test("skips a plan whose only open items are undated", () => {
    expect(
      composeDayPlanMessage(dayPlan({ noDate: [entry("Return the form", null)] }), link),
    ).toEqual({ outcome: "skipped_empty" });
  });

  test("represents overdue work before items dated tomorrow", () => {
    const result = composeDayPlanMessage(
      dayPlan({
        overdue: [entry("Pay the overdue trip balance", "2026-07-01")],
        today: [entry("Bring swimming kit")],
      }),
      link,
    );

    expect(result.outcome).toBe("composed");
    if (result.outcome !== "composed") return;
    expect(result.body).toContain("First: Pay the overdue trip balance");
    expect(result.body).not.toContain("Bring swimming kit");
  });
});

function entry(title: string, date: string | null = "2026-07-03"): DayPlanEntry {
  return { source: "responsibility", title, childIds: [], date };
}

function dayPlan(groups: Partial<Omit<DayPlan, "date">>): DayPlan {
  return { date: "2026-07-03", overdue: [], today: [], noDate: [], comingUp: [], ...groups };
}
