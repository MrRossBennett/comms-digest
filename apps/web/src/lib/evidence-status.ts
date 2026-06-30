type ClaimStatusUpsert = {
  userId: string;
  claimId: string;
  status: "dismissed";
};

type ClaimStatusKey = Pick<ClaimStatusUpsert, "userId" | "claimId">;

type ResponsibilityStatusUpsert = {
  userId: string;
  responsibilityId: string;
  status: "completed" | "dismissed";
};

type ResponsibilityStatusKey = Pick<ResponsibilityStatusUpsert, "userId" | "responsibilityId">;

export type EvidenceStatusPlan = {
  claimStatus: {
    upserts: ClaimStatusUpsert[];
    deletes: ClaimStatusKey[];
  };
  responsibilityStatus: {
    upserts: ResponsibilityStatusUpsert[];
    deletes: ResponsibilityStatusKey[];
  };
};

type DismissalRequest = {
  kind: "dismissal";
  ownerUserId: string;
  claimIds: string[];
  responsibilityIds: string[];
  dismissed: boolean;
};

type CompletionRequest = {
  kind: "completion";
  ownerUserId: string;
  responsibilityId: string;
  completed: boolean;
};

type EvidenceStatusRequest = DismissalRequest | CompletionRequest;

export function planEvidenceStatus(request: EvidenceStatusRequest): EvidenceStatusPlan {
  if (request.kind === "completion") {
    if (!request.completed) {
      return {
        claimStatus: { upserts: [], deletes: [] },
        responsibilityStatus: {
          upserts: [],
          deletes: [
            {
              userId: request.ownerUserId,
              responsibilityId: request.responsibilityId,
            },
          ],
        },
      };
    }

    return {
      claimStatus: { upserts: [], deletes: [] },
      responsibilityStatus: {
        upserts: [
          {
            userId: request.ownerUserId,
            responsibilityId: request.responsibilityId,
            status: "completed",
          },
        ],
        deletes: [],
      },
    };
  }

  if (!request.dismissed) {
    return {
      claimStatus: {
        upserts: [],
        deletes: request.claimIds.map((claimId) => ({
          userId: request.ownerUserId,
          claimId,
        })),
      },
      responsibilityStatus: {
        upserts: [],
        deletes: request.responsibilityIds.map((responsibilityId) => ({
          userId: request.ownerUserId,
          responsibilityId,
        })),
      },
    };
  }

  return {
    claimStatus: {
      upserts: request.claimIds.map((claimId) => ({
        userId: request.ownerUserId,
        claimId,
        status: "dismissed",
      })),
      deletes: [],
    },
    responsibilityStatus: {
      upserts: request.responsibilityIds.map((responsibilityId) => ({
        userId: request.ownerUserId,
        responsibilityId,
        status: "dismissed",
      })),
      deletes: [],
    },
  };
}
