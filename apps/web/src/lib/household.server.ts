import "@tanstack/react-start/server-only";
import { db } from "@repo/db";
import { child, household, school } from "@repo/db/schema";
import { and, eq, notInArray } from "drizzle-orm";

import { householdSetupSchema } from "./household";

export async function getHouseholdForOwner(ownerUserId: string) {
  const [householdRow] = await db
    .select({ id: household.id })
    .from(household)
    .where(eq(household.ownerUserId, ownerUserId))
    .limit(1);

  if (!householdRow) {
    return null;
  }

  const schools = await db
    .select({
      id: school.id,
      name: school.name,
    })
    .from(school)
    .where(eq(school.householdId, householdRow.id))
    .orderBy(school.createdAt);
  const children = await db
    .select({
      id: child.id,
      schoolId: child.schoolId,
      displayName: child.displayName,
      schoolYear: child.schoolYear,
      className: child.className,
    })
    .from(child)
    .where(eq(child.householdId, householdRow.id))
    .orderBy(child.createdAt);

  return {
    id: householdRow.id,
    schools,
    children,
  };
}

export async function saveHouseholdForOwner(ownerUserId: string, input: unknown) {
  const setup = householdSetupSchema.parse(input);

  await db.transaction(async (transaction) => {
    const [existingHousehold] = await transaction
      .select({ id: household.id })
      .from(household)
      .where(eq(household.ownerUserId, ownerUserId))
      .limit(1);
    const householdId = existingHousehold?.id ?? crypto.randomUUID();

    if (!existingHousehold) {
      await transaction.insert(household).values({
        id: householdId,
        ownerUserId,
      });
    } else {
      await transaction
        .update(household)
        .set({ updatedAt: new Date() })
        .where(eq(household.id, householdId));
    }

    const existingSchools = await transaction
      .select({ id: school.id })
      .from(school)
      .where(eq(school.householdId, householdId));
    const existingSchoolIds = new Set(existingSchools.map(({ id }) => id));
    const schoolIdsByKey = new Map(
      setup.schools.map((householdSchool) => [
        householdSchool.key,
        existingSchoolIds.has(householdSchool.key) ? householdSchool.key : crypto.randomUUID(),
      ]),
    );
    const schoolIdFor = (schoolKey: string) => {
      const schoolId = schoolIdsByKey.get(schoolKey);
      if (!schoolId) {
        throw new Error(`Child references unknown School ${schoolKey}`);
      }
      return schoolId;
    };
    await Promise.all(
      setup.schools.map((householdSchool) =>
        transaction
          .insert(school)
          .values({
            id: schoolIdFor(householdSchool.key),
            householdId,
            name: householdSchool.name,
          })
          .onConflictDoUpdate({
            target: school.id,
            set: {
              name: householdSchool.name,
              updatedAt: new Date(),
            },
          }),
      ),
    );

    const existingChildren = await transaction
      .select({ id: child.id })
      .from(child)
      .where(eq(child.householdId, householdId));
    const existingChildIds = new Set(existingChildren.map(({ id }) => id));
    const childIdsByKey = new Map(
      setup.children.map((householdChild) => [
        householdChild.key,
        existingChildIds.has(householdChild.key) ? householdChild.key : crypto.randomUUID(),
      ]),
    );
    const childIdFor = (childKey: string) => {
      const childId = childIdsByKey.get(childKey);
      if (!childId) {
        throw new Error(`Unknown Child ${childKey}`);
      }
      return childId;
    };
    await Promise.all(
      setup.children.map((householdChild) =>
        transaction
          .insert(child)
          .values({
            id: childIdFor(householdChild.key),
            householdId,
            schoolId: schoolIdFor(householdChild.schoolKey),
            displayName: householdChild.displayName,
            schoolYear: householdChild.schoolYear,
            className: householdChild.className,
          })
          .onConflictDoUpdate({
            target: child.id,
            set: {
              schoolId: schoolIdFor(householdChild.schoolKey),
              displayName: householdChild.displayName,
              schoolYear: householdChild.schoolYear,
              className: householdChild.className,
              updatedAt: new Date(),
            },
          }),
      ),
    );

    await transaction
      .delete(child)
      .where(
        and(eq(child.householdId, householdId), notInArray(child.id, [...childIdsByKey.values()])),
      );
    await transaction
      .delete(school)
      .where(
        and(
          eq(school.householdId, householdId),
          notInArray(school.id, [...schoolIdsByKey.values()]),
        ),
      );
  });

  return getHouseholdForOwner(ownerUserId);
}
