import "@tanstack/react-start/server-only";
import { db } from "@repo/db";
import { child, household, householdRoutine, householdRoutineChild, school } from "@repo/db/schema";
import {
  householdRoutineInputSchema,
  type HouseholdRoutine,
  type HouseholdRoutineInput,
} from "@repo/intelligence";
import { and, eq, inArray } from "drizzle-orm";

export async function listHouseholdRoutinesForOwner(ownerUserId: string) {
  const rows = await db
    .select({
      id: householdRoutine.id,
      title: householdRoutine.title,
      details: householdRoutine.details,
      schoolId: householdRoutine.schoolId,
      weekdays: householdRoutine.weekdays,
      startDate: householdRoutine.startDate,
      endDate: householdRoutine.endDate,
      createdAt: householdRoutine.createdAt,
      updatedAt: householdRoutine.updatedAt,
    })
    .from(householdRoutine)
    .innerJoin(household, eq(householdRoutine.householdId, household.id))
    .where(eq(household.ownerUserId, ownerUserId))
    .orderBy(householdRoutine.createdAt);

  const routineIds = rows.map(({ id }) => id);
  const studentLinks =
    routineIds.length === 0
      ? []
      : await db
          .select({
            routineId: householdRoutineChild.routineId,
            childId: householdRoutineChild.childId,
          })
          .from(householdRoutineChild)
          .where(inArray(householdRoutineChild.routineId, routineIds));

  return rows.map(
    (row): HouseholdRoutine => ({
      id: row.id,
      title: row.title,
      details: row.details ?? undefined,
      studentIds: studentLinks
        .filter(({ routineId }) => routineId === row.id)
        .map(({ childId }) => childId),
      schoolId: row.schoolId ?? undefined,
      weekdays: row.weekdays,
      startDate: row.startDate ?? undefined,
      endDate: row.endDate ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }),
  );
}

export async function saveHouseholdRoutineForOwner(
  ownerUserId: string,
  input: HouseholdRoutineInput,
) {
  const routineInput = householdRoutineInputSchema.parse(input);

  await db.transaction(async (transaction) => {
    const [ownedHousehold] = await transaction
      .select({ id: household.id })
      .from(household)
      .where(eq(household.ownerUserId, ownerUserId))
      .limit(1);
    if (!ownedHousehold) throw new Error("Household not found");

    const ownedStudents = await transaction
      .select({ id: child.id })
      .from(child)
      .where(
        and(eq(child.householdId, ownedHousehold.id), inArray(child.id, routineInput.studentIds)),
      );
    if (ownedStudents.length !== routineInput.studentIds.length) {
      throw new Error("Student not found");
    }

    if (routineInput.schoolId) {
      const [ownedSchool] = await transaction
        .select({ id: school.id })
        .from(school)
        .where(and(eq(school.id, routineInput.schoolId), eq(school.householdId, ownedHousehold.id)))
        .limit(1);
      if (!ownedSchool) throw new Error("School not found");
    }

    const routineId = routineInput.id ?? crypto.randomUUID();
    if (routineInput.id) {
      const [ownedRoutine] = await transaction
        .select({ id: householdRoutine.id })
        .from(householdRoutine)
        .where(
          and(
            eq(householdRoutine.id, routineInput.id),
            eq(householdRoutine.householdId, ownedHousehold.id),
          ),
        )
        .limit(1);
      if (!ownedRoutine) throw new Error("Household Routine not found");
    }

    await transaction
      .insert(householdRoutine)
      .values({
        id: routineId,
        householdId: ownedHousehold.id,
        schoolId: routineInput.schoolId,
        title: routineInput.title,
        details: routineInput.details,
        weekdays: [...routineInput.weekdays].sort((left, right) => left - right),
        startDate: routineInput.startDate,
        endDate: routineInput.endDate,
      })
      .onConflictDoUpdate({
        target: householdRoutine.id,
        set: {
          schoolId: routineInput.schoolId,
          title: routineInput.title,
          details: routineInput.details,
          weekdays: [...routineInput.weekdays].sort((left, right) => left - right),
          startDate: routineInput.startDate,
          endDate: routineInput.endDate,
          updatedAt: new Date(),
        },
      });

    await transaction
      .delete(householdRoutineChild)
      .where(eq(householdRoutineChild.routineId, routineId));
    await transaction.insert(householdRoutineChild).values(
      routineInput.studentIds.map((childId) => ({
        routineId,
        childId,
      })),
    );
  });

  return listHouseholdRoutinesForOwner(ownerUserId);
}

export async function deleteHouseholdRoutineForOwner(ownerUserId: string, routineId: string) {
  const [ownedRoutine] = await db
    .select({ id: householdRoutine.id })
    .from(householdRoutine)
    .innerJoin(household, eq(householdRoutine.householdId, household.id))
    .where(and(eq(householdRoutine.id, routineId), eq(household.ownerUserId, ownerUserId)))
    .limit(1);
  if (!ownedRoutine) throw new Error("Household Routine not found");

  await db.delete(householdRoutine).where(eq(householdRoutine.id, routineId));
  return { id: routineId };
}
