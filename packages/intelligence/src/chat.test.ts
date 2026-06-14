import { expect, test } from "vite-plus/test";

import {
  CHAT_REFUSAL,
  latestUserQuestion,
  selectChatEvidence,
  type GroundedChatEvidence,
  type GroundedChatMessage,
} from "./chat";

const evidence: GroundedChatEvidence[] = [
  {
    id: "swimming",
    claim: "Year 4 swimming starts on Monday.",
    citation: "Swimming lessons start on Monday.",
    subject: "Year 4 swimming",
    receivedAt: "2026-06-12T09:00:00.000Z",
    senderAddress: "office@example.test",
    schoolName: "Oakfield Primary",
    audience: "Year 4",
    studentNames: ["Alex"],
  },
  {
    id: "trip",
    claim: "The museum trip payment is due on Friday.",
    citation: "Please pay for the museum trip by Friday.",
    subject: "Museum trip",
    receivedAt: "2026-06-13T09:00:00.000Z",
    senderAddress: "trips@example.test",
    schoolName: "Oakfield Primary",
    audience: "Year 6",
    studentNames: ["Sam"],
  },
];

test("selects evidence matching a Student name and topic", () => {
  expect(selectChatEvidence("When is Alex swimming?", evidence).map(({ id }) => id)).toEqual([
    "swimming",
  ]);
});

test("returns recent evidence for an overview question", () => {
  expect(selectChatEvidence("What do I need to know next?", evidence).map(({ id }) => id)).toEqual([
    "trip",
    "swimming",
  ]);
});

test("returns no evidence for an unrelated unsupported question", () => {
  expect(selectChatEvidence("What is the weather in Paris?", evidence)).toEqual([]);
  expect(CHAT_REFUSAL).toContain("stored school communications");
});

test("reads the latest user text from AI SDK messages", () => {
  const messages: GroundedChatMessage[] = [
    { id: "1", role: "user", parts: [{ type: "text", text: "First question" }] },
    { id: "2", role: "assistant", parts: [{ type: "text", text: "Answer" }] },
    { id: "3", role: "user", parts: [{ type: "text", text: "Latest question" }] },
  ];

  expect(latestUserQuestion(messages)).toBe("Latest question");
});
