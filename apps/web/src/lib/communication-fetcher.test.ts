import { describe, expect, test, vi } from "vite-plus/test";

import {
  type ConfirmedSource,
  createRecordedFetcher,
  readGmailMessageContent,
} from "./communication-fetcher";

function confirmedSource(overrides: Partial<ConfirmedSource> = {}): ConfirmedSource {
  return {
    id: "source-1",
    schoolId: "school-1",
    senderName: "School Office",
    senderDomain: "school.test",
    audience: "school",
    discovery: "sample",
    childIds: [],
    ...overrides,
  };
}

function base64Url(text: string) {
  return Buffer.from(text, "utf8").toString("base64url");
}

describe("recorded fetcher", () => {
  test("produces a candidate only for sample sources", async () => {
    const fetcher = createRecordedFetcher({ children: [] });

    const candidates = await fetcher.fetch([
      confirmedSource({ id: "sample-source", discovery: "sample" }),
      confirmedSource({ id: "gmail-source", discovery: "gmail" }),
      confirmedSource({ id: "manual-source", discovery: "manual" }),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.source.id).toBe("sample-source");
    expect(candidates[0]?.externalMessageId).toBe("sample:sample-source:first-digest");
  });

  test("uses the selected Student's display name and carries a recorded extraction", async () => {
    const fetcher = createRecordedFetcher({ children: [{ id: "child-1", displayName: "Mia" }] });

    const [candidate] = await fetcher.fetch([
      confirmedSource({ audience: "children", childIds: ["child-1"] }),
    ]);

    expect(candidate?.subject).toBe("Mia's museum visit");
    // Recorded extraction means the live model is never called for sample candidates.
    expect(candidate?.recordedExtraction?.responsibilities).toHaveLength(1);
    expect(candidate?.recordedExtraction?.claims[0]?.content).toContain("Mia");
  });

  test("falls back to a school-wide candidate without selected Students", async () => {
    const fetcher = createRecordedFetcher({ children: [] });

    const [candidate] = await fetcher.fetch([confirmedSource({ audience: "school" })]);

    expect(candidate?.subject).toBe("Sports day");
    expect(candidate?.recordedExtraction?.responsibilities).toHaveLength(0);
  });
});

describe("Gmail message content", () => {
  test("decodes text/plain parts into source text", async () => {
    const downloadAttachment = vi.fn(async () => null);

    const sourceText = await readGmailMessageContent(
      {
        mimeType: "multipart/alternative",
        parts: [{ mimeType: "text/plain", body: { data: base64Url("Sports day is on Friday.") } }],
      },
      { downloadAttachment },
    );

    expect(sourceText).toBe("Sports day is on Friday.");
    expect(downloadAttachment).not.toHaveBeenCalled();
  });

  test("returns null when there is no text and no attachment data", async () => {
    const sourceText = await readGmailMessageContent(
      { mimeType: "text/html", body: { data: base64Url("<p>ignored</p>") } },
      { downloadAttachment: async () => null },
    );

    expect(sourceText).toBeNull();
  });
});
