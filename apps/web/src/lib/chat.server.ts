import "@tanstack/react-start/server-only";
import { db } from "@repo/db";
import {
  child,
  citation,
  claim,
  claimStatus,
  household,
  responsibility,
  responsibilityClaim,
  responsibilityStatus,
  school,
  schoolCommunication,
  schoolCommunicationChild,
} from "@repo/db/schema";
import { formatRoutineSchedule, type GroundedChatEvidence } from "@repo/intelligence";
import { and, eq, isNull, or } from "drizzle-orm";

import { listHouseholdRoutinesForOwner } from "./household-routine.server";

export async function listGroundedChatEvidence(userId: string) {
  const [
    rows,
    householdChildren,
    householdSchools,
    communicationChildren,
    responsibilityRows,
    routines,
  ] = await Promise.all([
    db
      .select({
        id: citation.id,
        claimId: claim.id,
        claim: claim.content,
        citation: citation.quote,
        subject: schoolCommunication.subject,
        receivedAt: schoolCommunication.receivedAt,
        senderAddress: schoolCommunication.senderAddress,
        schoolId: schoolCommunication.schoolId,
        schoolName: school.name,
        audienceScope: claim.audienceScope,
        audience: claim.audienceOriginalWording,
        communicationId: schoolCommunication.id,
      })
      .from(citation)
      .innerJoin(claim, eq(citation.claimId, claim.id))
      .innerJoin(schoolCommunication, eq(claim.communicationId, schoolCommunication.id))
      .innerJoin(household, eq(schoolCommunication.householdId, household.id))
      .leftJoin(school, eq(schoolCommunication.schoolId, school.id))
      .leftJoin(
        claimStatus,
        and(
          eq(claimStatus.claimId, claim.id),
          eq(claimStatus.userId, userId),
          eq(claimStatus.status, "dismissed"),
        ),
      )
      .where(and(eq(household.ownerUserId, userId), isNull(claimStatus.claimId))),
    db
      .select({
        id: child.id,
        displayName: child.displayName,
        schoolYear: child.schoolYear,
        className: child.className,
        schoolId: child.schoolId,
      })
      .from(child)
      .innerJoin(household, eq(child.householdId, household.id))
      .where(eq(household.ownerUserId, userId)),
    db
      .select({
        id: school.id,
        name: school.name,
      })
      .from(school)
      .innerJoin(household, eq(school.householdId, household.id))
      .where(eq(household.ownerUserId, userId)),
    db
      .select({
        communicationId: schoolCommunicationChild.communicationId,
        childId: schoolCommunicationChild.childId,
      })
      .from(schoolCommunicationChild)
      .innerJoin(
        schoolCommunication,
        eq(schoolCommunicationChild.communicationId, schoolCommunication.id),
      )
      .innerJoin(household, eq(schoolCommunication.householdId, household.id))
      .where(eq(household.ownerUserId, userId)),
    db
      .select({
        claimId: responsibilityClaim.claimId,
        title: responsibility.title,
        dueDateOriginalWording: responsibility.dueDateOriginalWording,
        amountCurrency: responsibility.amountCurrency,
        amountMinorUnits: responsibility.amountMinorUnits,
      })
      .from(responsibilityClaim)
      .innerJoin(responsibility, eq(responsibilityClaim.responsibilityId, responsibility.id))
      .innerJoin(household, eq(responsibility.householdId, household.id))
      .leftJoin(
        responsibilityStatus,
        and(
          eq(responsibilityStatus.responsibilityId, responsibility.id),
          eq(responsibilityStatus.userId, userId),
        ),
      )
      .where(
        and(
          eq(household.ownerUserId, userId),
          or(
            isNull(responsibilityStatus.responsibilityId),
            eq(responsibilityStatus.status, "unresolved"),
          ),
        ),
      ),
    listHouseholdRoutinesForOwner(userId),
  ]);

  const communicationEvidence = rows.map((row): GroundedChatEvidence => {
    const directlyScopedChildIds = communicationChildren
      .filter(({ communicationId }) => communicationId === row.communicationId)
      .map(({ childId }) => childId);
    const audience = row.audience.toLocaleLowerCase("en-GB");
    const studentNames = householdChildren
      .filter((student) => {
        if (directlyScopedChildIds.includes(student.id)) return true;
        if (student.schoolId !== row.schoolId) return false;
        if (row.audienceScope === "school" || row.audienceScope === "household") {
          return true;
        }

        return [student.schoolYear, student.className]
          .filter((value): value is string => Boolean(value))
          .some((value) => audience.includes(value.toLocaleLowerCase("en-GB")));
      })
      .map(({ displayName }) => displayName);

    return {
      id: row.id,
      claim: row.claim,
      citation: row.citation,
      subject: row.subject ?? undefined,
      receivedAt: row.receivedAt.toISOString(),
      senderAddress: row.senderAddress,
      schoolName: row.schoolName ?? undefined,
      audience: row.audience,
      studentNames,
      responsibilities: responsibilityRows
        .filter(({ claimId }) => claimId === row.claimId)
        .map(({ title, dueDateOriginalWording, amountCurrency, amountMinorUnits }) => ({
          title,
          dueDateOriginalWording: dueDateOriginalWording ?? undefined,
          amountCurrency: amountCurrency ?? undefined,
          amountMinorUnits: amountMinorUnits ?? undefined,
        })),
    };
  });

  const routineEvidence = routines.map((routine): GroundedChatEvidence => {
    const studentNames = householdChildren
      .filter(({ id }) => routine.studentIds.includes(id))
      .map(({ displayName }) => displayName);
    const schedule = formatRoutineSchedule(routine.weekdays);
    const schoolName = householdSchools.find(({ id }) => id === routine.schoolId)?.name;
    const dateBoundary = [
      routine.startDate ? `from ${routine.startDate}` : undefined,
      routine.endDate ? `until ${routine.endDate}` : undefined,
    ]
      .filter(Boolean)
      .join(" ");
    const claim = `${routine.title} happens every ${schedule}${dateBoundary ? ` ${dateBoundary}` : ""}.${routine.details ? ` ${routine.details}` : ""}`;

    return {
      id: `routine:${routine.id}`,
      claim,
      citation: claim,
      subject: routine.title,
      receivedAt: routine.updatedAt,
      senderAddress: "Household-added Routine",
      schoolName,
      audience: studentNames.join(", "),
      studentNames,
      responsibilities: [],
    };
  });

  return [...communicationEvidence, ...routineEvidence];
}
