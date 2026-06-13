import "@tanstack/react-start/server-only";
import { db } from "@repo/db";
import { child, household, school } from "@repo/db/schema";
import { eq } from "drizzle-orm";

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
      await transaction.delete(school).where(eq(school.householdId, householdId));
      await transaction
        .update(household)
        .set({ updatedAt: new Date() })
        .where(eq(household.id, householdId));
    }

    const schoolId = crypto.randomUUID();
    await transaction.insert(school).values({
      id: schoolId,
      householdId,
      name: setup.schoolName,
    });
    await transaction.insert(child).values(
      setup.children.map((householdChild) => ({
        id: crypto.randomUUID(),
        householdId,
        schoolId,
        displayName: householdChild.displayName,
        schoolYear: householdChild.schoolYear,
        className: householdChild.className,
      })),
    );
  });

  return getHouseholdForOwner(ownerUserId);
}
