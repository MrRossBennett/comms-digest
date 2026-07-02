import { z } from "zod";

import { digestSchema } from "./digest";
import { nextRoutineOccurrence, routineWeekdaySchema } from "./routine";

const dayPlanRoutineSchema = z
  .object({
    id: z.uuid(),
    title: z.string().min(1),
    studentIds: z.array(z.uuid()).min(1),
    weekdays: z.array(routineWeekdaySchema).min(1),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
  })
  .strict();

const composeDayPlanInputSchema = z
  .object({
    digest: digestSchema,
    routines: z.array(dayPlanRoutineSchema),
    completedResponsibilityIds: z.array(z.uuid()),
    dismissedClaimIds: z.array(z.uuid()),
    dismissedResponsibilityIds: z.array(z.uuid()),
    // When a Responsibility has no resolved due date, we fall back to the date
    // its email arrived — as a recency signal for ordering, never as a deadline.
    receivedAtByResponsibilityId: z
      .record(z.string(), z.iso.datetime({ offset: true }))
      .default({}),
    referenceDate: z.iso.date(),
    horizonDays: z.int().positive().default(7),
  })
  .strict();

const dayPlanEntrySchema = z
  .object({
    source: z.enum(["responsibility", "claim", "routine"]),
    title: z.string().min(1),
    childIds: z.array(z.uuid()),
    date: z.iso.date().nullable(),
    receivedAt: z.iso.datetime({ offset: true }).optional(),
    responsibilityId: z.uuid().optional(),
    claimIds: z.array(z.uuid()).optional(),
    routineId: z.uuid().optional(),
  })
  .strict();

const dayPlanSchema = z
  .object({
    date: z.iso.date(),
    overdue: z.array(dayPlanEntrySchema),
    today: z.array(dayPlanEntrySchema),
    noDate: z.array(dayPlanEntrySchema),
    comingUp: z.array(dayPlanEntrySchema),
  })
  .strict();

export type DayPlan = z.infer<typeof dayPlanSchema>;
export type DayPlanEntry = z.infer<typeof dayPlanEntrySchema>;

export function composeDayPlan(input: unknown): DayPlan {
  const {
    digest,
    routines,
    completedResponsibilityIds,
    dismissedClaimIds,
    dismissedResponsibilityIds,
    receivedAtByResponsibilityId,
    referenceDate,
    horizonDays,
  } = composeDayPlanInputSchema.parse(input);

  const completed = new Set(completedResponsibilityIds);
  const dismissedClaims = new Set(dismissedClaimIds);
  const dismissedResponsibilities = new Set(dismissedResponsibilityIds);
  const horizonDate = addDays(referenceDate, horizonDays);
  const items = [...digest.actNow, ...digest.comingUp, ...digest.goodToKnow];
  const isOpen = (responsibilityId: string) =>
    !completed.has(responsibilityId) && !dismissedResponsibilities.has(responsibilityId);
  const claimIdsWithOpenResponsibility = new Set(
    items
      .flatMap((item) => item.responsibilities)
      .filter((responsibility) => isOpen(responsibility.id))
      .flatMap((responsibility) => responsibility.supportingClaimIds),
  );

  const overdue: DayPlanEntry[] = [];
  const today: DayPlanEntry[] = [];
  const noDate: DayPlanEntry[] = [];
  const comingUp: DayPlanEntry[] = [];

  for (const item of items) {
    for (const responsibility of item.responsibilities) {
      if (!isOpen(responsibility.id)) continue;

      const entry: DayPlanEntry = {
        source: "responsibility",
        title: responsibility.title,
        childIds: item.childIds,
        date: responsibility.dueDate?.resolvedDate ?? null,
        receivedAt: receivedAtByResponsibilityId[responsibility.id],
        responsibilityId: responsibility.id,
        claimIds: responsibility.supportingClaimIds,
      };

      if (entry.date === null) noDate.push(entry);
      else if (entry.date < referenceDate) overdue.push(entry);
      else if (entry.date === referenceDate) today.push(entry);
      else if (entry.date <= horizonDate) comingUp.push(entry);
    }

    for (const claim of item.claims) {
      const date = claim.date?.resolvedDate;
      if (!date) continue;
      if (dismissedClaims.has(claim.id)) continue;
      if (claimIdsWithOpenResponsibility.has(claim.id)) continue;
      if (date < referenceDate) continue;

      const entry: DayPlanEntry = {
        source: "claim",
        title: item.title,
        childIds: item.childIds,
        date,
        claimIds: [claim.id],
      };

      if (date === referenceDate) today.push(entry);
      else if (date <= horizonDate) comingUp.push(entry);
    }
  }

  for (const routine of routines) {
    const occurrence = nextRoutineOccurrence(routine, referenceDate);
    if (!occurrence) continue;

    const entry: DayPlanEntry = {
      source: "routine",
      title: routine.title,
      childIds: routine.studentIds,
      date: occurrence,
      routineId: routine.id,
    };

    if (occurrence === referenceDate) today.push(entry);
    else if (occurrence <= horizonDate) comingUp.push(entry);
  }

  const sortEntries = (entries: DayPlanEntry[]) =>
    entries.sort(
      (a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.title.localeCompare(b.title),
    );
  // Undated to-dos carry no deadline, so order them by the email that surfaced
  // them, most recent first.
  const sortByReceivedAtDesc = (entries: DayPlanEntry[]) =>
    entries.sort(
      (a, b) =>
        (b.receivedAt ?? "").localeCompare(a.receivedAt ?? "") || a.title.localeCompare(b.title),
    );

  return dayPlanSchema.parse({
    date: referenceDate,
    overdue: sortEntries(overdue),
    today: sortEntries(today),
    noDate: sortByReceivedAtDesc(noDate),
    comingUp: sortEntries(comingUp),
  });
}

function addDays(date: string, days: number) {
  const instant = new Date(`${date}T00:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}
