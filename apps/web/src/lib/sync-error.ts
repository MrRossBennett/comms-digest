// Classify a sync error as terminal (needs reauth) vs transient (retry next sweep).
// Terminal errors stop retries until the Household Owner reconnects Gmail.
export function isRootCauseReauth(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const flagged = (error as Error & { needsReauth?: boolean }).needsReauth === true;
  const msg = error.message.toLowerCase();
  return (
    flagged ||
    msg.includes("revoked") ||
    msg.includes("invalid_grant") ||
    msg.includes("token expired") ||
    msg.includes("unauthorized")
  );
}
