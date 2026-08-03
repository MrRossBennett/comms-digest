export function filterNewCandidates<T extends { externalMessageId: string }>(
  candidates: T[],
  existingExternalMessageIds: string[],
): T[] {
  const existing = new Set(existingExternalMessageIds);
  return candidates.filter(({ externalMessageId }) => !existing.has(externalMessageId));
}
