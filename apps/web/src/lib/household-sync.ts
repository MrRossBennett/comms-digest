// Returns true if persisted sync state indicates Gmail needs to be reconnected.
// Returns false when syncState is null (no sync record yet — first-time user).
export function needsReauthFromSyncState(syncState: { needsReauth: boolean } | null): boolean {
  return syncState?.needsReauth ?? false;
}
