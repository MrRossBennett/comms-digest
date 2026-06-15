import { z } from "zod";

export const routineWeekdaySchema = z.int().min(1).max(7);

export const householdRoutineInputSchema = z
  .object({
    id: z.uuid().optional(),
    title: z.string().trim().min(1).max(120),
    details: z.string().trim().max(1_000).optional(),
    studentIds: z
      .array(z.uuid())
      .min(1)
      .max(20)
      .refine((values) => new Set(values).size === values.length, "Choose each Student once"),
    schoolId: z.uuid().optional(),
    weekdays: z
      .array(routineWeekdaySchema)
      .min(1)
      .max(7)
      .refine((values) => new Set(values).size === values.length, "Choose each day once"),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
  })
  .strict()
  .refine(
    ({ startDate, endDate }) => !startDate || !endDate || endDate >= startDate,
    "End date must be on or after start date",
  );

export type HouseholdRoutineInput = z.infer<typeof householdRoutineInputSchema>;

export type HouseholdRoutine = {
  id: string;
  title: string;
  details?: string;
  studentIds: string[];
  schoolId?: string;
  weekdays: number[];
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
};

export const routineWeekdays = [
  { value: 1, shortLabel: "Mon", label: "Monday" },
  { value: 2, shortLabel: "Tue", label: "Tuesday" },
  { value: 3, shortLabel: "Wed", label: "Wednesday" },
  { value: 4, shortLabel: "Thu", label: "Thursday" },
  { value: 5, shortLabel: "Fri", label: "Friday" },
  { value: 6, shortLabel: "Sat", label: "Saturday" },
  { value: 7, shortLabel: "Sun", label: "Sunday" },
] as const;

export function formatRoutineSchedule(weekdays: number[]) {
  const labels = routineWeekdays
    .filter(({ value }) => weekdays.includes(value))
    .map(({ label }) => label);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

export function nextRoutineOccurrence(
  routine: Pick<HouseholdRoutine, "weekdays" | "startDate" | "endDate">,
  today: string,
) {
  const lowerBound = routine.startDate && routine.startDate > today ? routine.startDate : today;
  const candidate = new Date(`${lowerBound}T12:00:00Z`);

  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(candidate);
    date.setUTCDate(candidate.getUTCDate() + offset);
    const value = date.toISOString().slice(0, 10);
    const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    if (routine.endDate && value > routine.endDate) return undefined;
    if (routine.weekdays.includes(weekday)) return value;
  }

  return undefined;
}
