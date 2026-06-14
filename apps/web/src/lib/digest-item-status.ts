type DigestEvidence = {
  claims: Array<{ id: string }>;
  responsibilities: Array<{ id: string }>;
};

export function digestEvidenceKey(claimIds: string[]) {
  return [...claimIds].sort().join(":");
}

export function isDigestItemDismissed(
  item: DigestEvidence,
  dismissedClaimIds: Set<string>,
  dismissedResponsibilityIds: Set<string>,
) {
  return (
    item.claims.every(({ id }) => dismissedClaimIds.has(id)) &&
    item.responsibilities.every(({ id }) => dismissedResponsibilityIds.has(id))
  );
}
