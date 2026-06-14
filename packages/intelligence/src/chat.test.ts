import { expect, test } from "vite-plus/test";

import {
  CHAT_REFUSAL,
  chatRetrievalQuery,
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

test("drops weak partial matches when one source strongly matches the question", () => {
  expect(selectChatEvidence("When is the Summer Concert?", evidence).map(({ id }) => id)).toEqual(
    [],
  );

  const summerEvidence = [
    {
      ...evidence[0]!,
      id: "concert",
      claim: "The Summer Concert is on Thursday.",
      subject: "Summer Concert",
      citation: "Summer Concert on Thursday.",
    },
    {
      ...evidence[1]!,
      id: "festival",
      claim: "The summer festival is approaching.",
      subject: "Summer Festival",
      citation: "The summer festival is approaching.",
    },
  ];

  expect(
    selectChatEvidence("When is the Summer Concert?", summerEvidence).map(({ id }) => id),
  ).toEqual(["concert"]);
});

test("reads the latest user text from AI SDK messages", () => {
  const messages: GroundedChatMessage[] = [
    { id: "1", role: "user", parts: [{ type: "text", text: "First question" }] },
    { id: "2", role: "assistant", parts: [{ type: "text", text: "Answer" }] },
    { id: "3", role: "user", parts: [{ type: "text", text: "Latest question" }] },
  ];

  expect(latestUserQuestion(messages)).toBe("Latest question");
});

test("uses the previous user question to retrieve evidence for a pronoun follow-up", () => {
  const messages: GroundedChatMessage[] = [
    {
      id: "1",
      role: "user",
      parts: [{ type: "text", text: "When is the Summer Concert?" }],
    },
    {
      id: "2",
      role: "assistant",
      parts: [{ type: "text", text: "It is on Thursday." }],
    },
    { id: "3", role: "user", parts: [{ type: "text", text: "Where is it?" }] },
  ];

  expect(chatRetrievalQuery(messages)).toBe("When is the Summer Concert?\nWhere is it?");
});
