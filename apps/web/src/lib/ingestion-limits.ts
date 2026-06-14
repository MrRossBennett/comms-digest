export const MAX_NEW_GMAIL_MESSAGES_PER_RUN = 10;
export const MAX_GMAIL_SOURCE_TEXT_CHARACTERS = 20_000;

export function limitGmailSourceText(sourceText: string) {
  return sourceText.slice(0, MAX_GMAIL_SOURCE_TEXT_CHARACTERS);
}

export function selectNewGmailMessages<TMessage extends { id: string }>(
  messages: TMessage[],
  existingExternalMessageIds: Set<string>,
) {
  return messages
    .filter(({ id }) => !existingExternalMessageIds.has(id))
    .slice(0, MAX_NEW_GMAIL_MESSAGES_PER_RUN);
}
