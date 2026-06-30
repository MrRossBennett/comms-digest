import { describe, expect, test } from "vite-plus/test";

import { planEvidenceStatus } from "./evidence-status";

describe("Evidence Status planner", () => {
  test("dismissing Claims plans Claim upserts without Responsibility writes", () => {
    expect(
      planEvidenceStatus({
        kind: "dismissal",
        ownerUserId: "owner-1",
        claimIds: ["claim-1", "claim-2"],
        responsibilityIds: [],
        dismissed: true,
      }),
    ).toEqual({
      claimStatus: {
        upserts: [
          { userId: "owner-1", claimId: "claim-1", status: "dismissed" },
          { userId: "owner-1", claimId: "claim-2", status: "dismissed" },
        ],
        deletes: [],
      },
      responsibilityStatus: { upserts: [], deletes: [] },
    });
  });

  test("dismissing Claims and Responsibilities plans both sets of upserts", () => {
    expect(
      planEvidenceStatus({
        kind: "dismissal",
        ownerUserId: "owner-1",
        claimIds: ["claim-1"],
        responsibilityIds: ["responsibility-1"],
        dismissed: true,
      }),
    ).toEqual({
      claimStatus: {
        upserts: [{ userId: "owner-1", claimId: "claim-1", status: "dismissed" }],
        deletes: [],
      },
      responsibilityStatus: {
        upserts: [
          {
            userId: "owner-1",
            responsibilityId: "responsibility-1",
            status: "dismissed",
          },
        ],
        deletes: [],
      },
    });
  });

  test("un-dismissing plans deletes for Claims and Responsibilities", () => {
    expect(
      planEvidenceStatus({
        kind: "dismissal",
        ownerUserId: "owner-1",
        claimIds: ["claim-1"],
        responsibilityIds: ["responsibility-1"],
        dismissed: false,
      }),
    ).toEqual({
      claimStatus: {
        upserts: [],
        deletes: [{ userId: "owner-1", claimId: "claim-1" }],
      },
      responsibilityStatus: {
        upserts: [],
        deletes: [{ userId: "owner-1", responsibilityId: "responsibility-1" }],
      },
    });
  });

  test("completing a Responsibility plans a completed upsert", () => {
    expect(
      planEvidenceStatus({
        kind: "completion",
        ownerUserId: "owner-1",
        responsibilityId: "responsibility-1",
        completed: true,
      }),
    ).toEqual({
      claimStatus: { upserts: [], deletes: [] },
      responsibilityStatus: {
        upserts: [
          {
            userId: "owner-1",
            responsibilityId: "responsibility-1",
            status: "completed",
          },
        ],
        deletes: [],
      },
    });
  });

  test("un-completing a Responsibility plans a delete", () => {
    expect(
      planEvidenceStatus({
        kind: "completion",
        ownerUserId: "owner-1",
        responsibilityId: "responsibility-1",
        completed: false,
      }),
    ).toEqual({
      claimStatus: { upserts: [], deletes: [] },
      responsibilityStatus: {
        upserts: [],
        deletes: [{ userId: "owner-1", responsibilityId: "responsibility-1" }],
      },
    });
  });
});
