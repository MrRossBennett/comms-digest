import "@tanstack/react-start/server-only";
import { composeDayPlan, todayInTimezone } from "@repo/intelligence";

import { getHouseholdDigestForOwner } from "./household-digest.server";
import { listHouseholdRoutinesForOwner } from "./household-routine.server";

const HOUSEHOLD_TIMEZONE = "Europe/London";

export async function getDayPlanForOwner(ownerUserId: string) {
  const digestData = await getHouseholdDigestForOwner(ownerUserId);
  if (!digestData) return null;

  const routines = await listHouseholdRoutinesForOwner(ownerUserId);
  const digest = digestData.digest ?? { actNow: [], comingUp: [], goodToKnow: [] };
  const referenceDate = todayInTimezone(HOUSEHOLD_TIMEZONE, new Date());

  const dayPlan = composeDayPlan({
    digest,
    routines: routines.map((routine) => ({
      id: routine.id,
      title: routine.title,
      studentIds: routine.studentIds,
      weekdays: routine.weekdays,
      startDate: routine.startDate,
      endDate: routine.endDate,
    })),
    completedResponsibilityIds: digestData.completedResponsibilityIds,
    dismissedClaimIds: digestData.dismissedClaimIds,
    dismissedResponsibilityIds: digestData.dismissedResponsibilityIds,
    receivedAtByResponsibilityId: digestData.receivedAtByResponsibilityId,
    referenceDate,
  });

  return {
    household: digestData.household,
    dayPlan,
    digest,
    routines,
    communications: digestData.communications,
    hasEvidence: digestData.generatedAt !== null || routines.length > 0,
  };
}
