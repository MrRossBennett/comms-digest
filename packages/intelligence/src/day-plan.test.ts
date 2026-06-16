import { expect, test } from "vite-plus/test";

import { composeDayPlan } from "./day-plan";

const childId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c12";
const claimId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c01";
const responsibilityId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c02";

function digestItem({
  title,
  childIds = [childId],
  claimDate,
  responsibilityDueDate,
  claimId: itemClaimId = claimId,
}: {
  title: string;
  childIds?: string[];
  claimDate?: string;
  responsibilityDueDate?: string | null;
  claimId?: string;
}) {
  return {
    title,
    childIds,
    claims: [
      {
        id: itemClaimId,
        content: title,
        audience: { scope: "child" as const, originalWording: "Sam" },
        certainty: "confirmed" as const,
        date: claimDate ? { originalWording: claimDate, resolvedDate: claimDate } : undefined,
        citations: [
          {
            id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c03",
            communicationId: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c04",
            quote: title,
            start: 0,
            end: title.length,
          },
        ],
      },
    ],
    responsibilities:
      responsibilityDueDate === undefined
        ? []
        : [
            {
              id: responsibilityId,
              title,
              dueDate:
                responsibilityDueDate === null
                  ? undefined
                  : { originalWording: responsibilityDueDate, resolvedDate: responsibilityDueDate },
              supportingClaimIds: [itemClaimId],
            },
          ],
  };
}

function emptyDigest() {
  return { actNow: [], comingUp: [], goodToKnow: [] };
}

function baseInput(overrides: Partial<Parameters<typeof composeDayPlan>[0]> = {}) {
  return {
    digest: emptyDigest(),
    routines: [],
    completedResponsibilityIds: [],
    dismissedClaimIds: [],
    dismissedResponsibilityIds: [],
    referenceDate: "2026-06-15",
    ...overrides,
  };
}

test("an action due today lands in today", () => {
  const digest = {
    ...emptyDigest(),
    actNow: [
      digestItem({ title: "Return Sam's permission form", responsibilityDueDate: "2026-06-15" }),
    ],
  };

  const plan = composeDayPlan(baseInput({ digest }));

  expect(plan.today).toHaveLength(1);
  expect(plan.today[0]).toMatchObject({
    source: "responsibility",
    title: "Return Sam's permission form",
    responsibilityId,
    date: "2026-06-15",
  });
  expect(plan.overdue).toHaveLength(0);
});

test("an action due before D and still unresolved carries forward into overdue", () => {
  const digest = {
    ...emptyDigest(),
    actNow: [
      digestItem({ title: "Return Sam's permission form", responsibilityDueDate: "2026-06-10" }),
    ],
  };

  const plan = composeDayPlan(baseInput({ digest }));

  expect(plan.overdue).toHaveLength(1);
  expect(plan.overdue[0]).toMatchObject({ source: "responsibility", date: "2026-06-10" });
  expect(plan.today).toHaveLength(0);
});

test("a dated claim happening today with no open responsibility lands in today", () => {
  const digest = {
    ...emptyDigest(),
    goodToKnow: [digestItem({ title: "Crazy hair day", claimDate: "2026-06-15" })],
  };

  const plan = composeDayPlan(baseInput({ digest }));

  expect(plan.today).toHaveLength(1);
  expect(plan.today[0]).toMatchObject({
    source: "claim",
    title: "Crazy hair day",
    claimIds: [claimId],
    date: "2026-06-15",
  });
});

test("an unresolved responsibility with no resolved date lands only in noDate", () => {
  const digest = {
    ...emptyDigest(),
    actNow: [digestItem({ title: "Return the signed form", responsibilityDueDate: null })],
  };

  const plan = composeDayPlan(baseInput({ digest }));

  expect(plan.noDate).toHaveLength(1);
  expect(plan.noDate[0]).toMatchObject({ source: "responsibility", date: null });
  expect(plan.overdue).toHaveLength(0);
  expect(plan.today).toHaveLength(0);
  expect(plan.comingUp).toHaveLength(0);
});

test("items dated within the horizon land in comingUp; beyond the horizon they are excluded", () => {
  const digest = {
    ...emptyDigest(),
    comingUp: [
      digestItem({
        title: "Sam's museum trip",
        claimDate: "2026-06-22",
        childIds: [childId],
      }),
      digestItem({
        title: "End of term disco",
        claimDate: "2026-06-25",
        childIds: [childId],
      }),
    ],
  };

  const plan = composeDayPlan(baseInput({ digest }));

  expect(plan.comingUp.map(({ title }) => title)).toEqual(["Sam's museum trip"]);
});

test("a completed responsibility is excluded", () => {
  const digest = {
    ...emptyDigest(),
    actNow: [digestItem({ title: "Return the signed form", responsibilityDueDate: "2026-06-15" })],
  };

  const plan = composeDayPlan(
    baseInput({ digest, completedResponsibilityIds: [responsibilityId] }),
  );

  expect(plan.today).toHaveLength(0);
  expect(plan.overdue).toHaveLength(0);
  expect(plan.noDate).toHaveLength(0);
  expect(plan.comingUp).toHaveLength(0);
});

test("a dismissed responsibility is excluded", () => {
  const digest = {
    ...emptyDigest(),
    actNow: [digestItem({ title: "Return the signed form", responsibilityDueDate: "2026-06-15" })],
  };

  const plan = composeDayPlan(
    baseInput({ digest, dismissedResponsibilityIds: [responsibilityId] }),
  );

  expect(plan.today).toHaveLength(0);
});

test("a dismissed claim is excluded", () => {
  const digest = {
    ...emptyDigest(),
    goodToKnow: [digestItem({ title: "Crazy hair day", claimDate: "2026-06-15" })],
  };

  const plan = composeDayPlan(baseInput({ digest, dismissedClaimIds: [claimId] }));

  expect(plan.today).toHaveLength(0);
});

const routineId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c05";
const studentId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c06";

test("a Household Routine occurring today appears in today, and within the week in comingUp", () => {
  const routines = [
    { id: routineId, title: "PE kit", studentIds: [studentId], weekdays: [1] }, // 2026-06-15 is a Monday
    {
      id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c07",
      title: "Library day",
      studentIds: [studentId],
      weekdays: [4],
    }, // next Thursday is 2026-06-18
  ];

  const plan = composeDayPlan(baseInput({ routines }));

  expect(plan.today).toContainEqual(
    expect.objectContaining({ source: "routine", title: "PE kit", routineId, date: "2026-06-15" }),
  );
  expect(plan.comingUp).toContainEqual(
    expect.objectContaining({ source: "routine", title: "Library day", date: "2026-06-18" }),
  );
});

test("orders within a group by date then title", () => {
  const digest = {
    ...emptyDigest(),
    comingUp: [
      digestItem({
        title: "Zebra crossing safety talk",
        claimDate: "2026-06-17",
        claimId: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c08",
      }),
      digestItem({
        title: "Aardvark club starts",
        claimDate: "2026-06-17",
        claimId: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c09",
      }),
      digestItem({
        title: "Book fair",
        claimDate: "2026-06-16",
        claimId: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c0a",
      }),
    ],
  };

  const plan = composeDayPlan(baseInput({ digest }));

  expect(plan.comingUp.map(({ title }) => title)).toEqual([
    "Book fair",
    "Aardvark club starts",
    "Zebra crossing safety talk",
  ]);
});

test("carries childIds through so multi-Student attribution is correct", () => {
  const otherChildId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c09";
  const digest = {
    ...emptyDigest(),
    actNow: [
      digestItem({
        title: "Sibling sports day",
        responsibilityDueDate: "2026-06-15",
        childIds: [childId, otherChildId],
      }),
    ],
  };

  const plan = composeDayPlan(baseInput({ digest }));

  expect(plan.today[0]?.childIds).toEqual([childId, otherChildId]);
});

test("an empty Digest, no Routines, and no statuses yields empty groups", () => {
  const plan = composeDayPlan(baseInput());

  expect(plan).toEqual({
    date: "2026-06-15",
    overdue: [],
    today: [],
    noDate: [],
    comingUp: [],
  });
});

test("returns groups in Overdue, Today, No date, Coming up order", () => {
  expect(Object.keys(composeDayPlan(baseInput()))).toEqual([
    "date",
    "overdue",
    "today",
    "noDate",
    "comingUp",
  ]);
});
