import { describe, expect, test } from "vite-plus/test";

import {
  limitGmailSourceText,
  MAX_GMAIL_SOURCE_TEXT_CHARACTERS,
  MAX_NEW_GMAIL_MESSAGES_PER_RUN,
  selectNewGmailMessages,
} from "./ingestion-limits";

describe("Gmail ingestion limits", () => {
  test("selects at most ten messages that have not already been imported", () => {
    const messages = Array.from({ length: 15 }, (_, index) => ({ id: `message-${index}` }));
    const selected = selectNewGmailMessages(messages, new Set(["message-0", "message-1"]));

    expect(selected).toHaveLength(MAX_NEW_GMAIL_MESSAGES_PER_RUN);
    expect(selected[0]?.id).toBe("message-2");
    expect(selected.at(-1)?.id).toBe("message-11");
  });

  test("caps email text before it is sent to the extraction model", () => {
    const sourceText = "a".repeat(MAX_GMAIL_SOURCE_TEXT_CHARACTERS + 100);

    expect(limitGmailSourceText(sourceText)).toHaveLength(MAX_GMAIL_SOURCE_TEXT_CHARACTERS);
  });
});
