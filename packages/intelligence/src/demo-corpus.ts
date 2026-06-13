import { modelExtractionSchema, schoolCommunicationSchema } from "./contracts";
import { householdDigestConfigSchema } from "./digest";

const alexId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c01";
const samId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c12";

function recordedCommunication(input: {
  id: string;
  receivedAt: string;
  subject: string;
  sourceText: string;
  claims: Array<{
    content: string;
    audience: {
      scope: "child" | "group" | "school" | "household" | "unresolved";
      originalWording: string;
    };
    certainty: "confirmed" | "tentative" | "unclear_needs_review" | "contradicted";
    quote: string;
    date?: { originalWording: string; resolvedDate: string | null };
  }>;
  responsibilities: Array<{
    title: string;
    claimPositions: number[];
    dueDate?: { originalWording: string; resolvedDate: string | null };
    amount?: { currency: string; minorUnits: number };
  }>;
}) {
  return {
    communication: schoolCommunicationSchema.parse({
      id: input.id,
      kind: "email",
      receivedAt: input.receivedAt,
      householdTimezone: "Europe/London",
      subject: input.subject,
      sourceText: input.sourceText,
    }),
    recordedExtraction: modelExtractionSchema.parse({
      claims: input.claims.map(({ quote, ...claim }) => {
        const start = input.sourceText.indexOf(quote);
        if (start === -1) {
          throw new Error(`Recorded Citation is missing from "${input.subject}"`);
        }

        return {
          ...claim,
          citations: [{ quote, start, end: start + quote.length }],
        };
      }),
      responsibilities: input.responsibilities,
    }),
  };
}

const swimmingAnnouncementText =
  "Year 4 swimming starts on Monday 19 January. Please pay £12 by Friday 16 January.";
const swimmingReminderText = "Reminder for Year 4 families: please pay £12 for swimming by Friday.";
const swimmingCancellationText = "Year 4 swimming on Monday 19 January has been cancelled.";
const discoText = "Year 6 disco tickets are now available.";
const museumTripText =
  "Year 6 visit the Science Museum on Tuesday 27 January. Please return Sam's signed permission form by Friday 23 January.";
const bakeSaleText = "Year 2 bake sale is on Friday 30 January. Cakes can be left at reception.";

export const demoHousehold = householdDigestConfigSchema.parse({
  children: [
    { id: alexId, name: "Alex", schoolYear: "Year 4" },
    { id: samId, name: "Sam", schoolYear: "Year 6" },
  ],
});

export const demoCorpus = [
  recordedCommunication({
    id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c02",
    receivedAt: "2026-01-12T16:30:00.000Z",
    subject: "Year 4 swimming",
    sourceText: swimmingAnnouncementText,
    claims: [
      {
        content: "Year 4 swimming starts on 19 January 2026.",
        audience: { scope: "group", originalWording: "Year 4" },
        certainty: "confirmed",
        date: { originalWording: "Monday 19 January", resolvedDate: "2026-01-19" },
        quote: "Year 4 swimming starts on Monday 19 January.",
      },
      {
        content: "Year 4 swimming payment of £12 is due by 16 January 2026.",
        audience: { scope: "group", originalWording: "Year 4" },
        certainty: "confirmed",
        date: { originalWording: "Friday 16 January", resolvedDate: "2026-01-16" },
        quote: "Please pay £12 by Friday 16 January.",
      },
    ],
    responsibilities: [
      {
        title: "Pay £12 for Year 4 swimming",
        dueDate: { originalWording: "Friday 16 January", resolvedDate: "2026-01-16" },
        amount: { currency: "GBP", minorUnits: 1200 },
        claimPositions: [1],
      },
    ],
  }),
  recordedCommunication({
    id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c08",
    receivedAt: "2026-01-14T16:30:00.000Z",
    subject: "Swimming payment reminder",
    sourceText: swimmingReminderText,
    claims: [
      {
        content: "Year 4 swimming payment of £12 remains due by 16 January 2026.",
        audience: { scope: "group", originalWording: "Year 4 families" },
        certainty: "confirmed",
        date: { originalWording: "Friday", resolvedDate: "2026-01-16" },
        quote: "please pay £12 for swimming by Friday.",
      },
    ],
    responsibilities: [
      {
        title: "Pay £12 for Year 4 swimming",
        dueDate: { originalWording: "Friday", resolvedDate: "2026-01-16" },
        amount: { currency: "GBP", minorUnits: 1200 },
        claimPositions: [0],
      },
    ],
  }),
  recordedCommunication({
    id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c0c",
    receivedAt: "2026-01-15T16:30:00.000Z",
    subject: "Swimming cancelled",
    sourceText: swimmingCancellationText,
    claims: [
      {
        content: "Year 4 swimming has been cancelled.",
        audience: { scope: "group", originalWording: "Year 4" },
        certainty: "confirmed",
        date: { originalWording: "Monday 19 January", resolvedDate: "2026-01-19" },
        quote: swimmingCancellationText,
      },
    ],
    responsibilities: [],
  }),
  recordedCommunication({
    id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c0f",
    receivedAt: "2026-01-15T17:00:00.000Z",
    subject: "Year 6 disco",
    sourceText: discoText,
    claims: [
      {
        content: "Year 6 disco tickets are available.",
        audience: { scope: "group", originalWording: "Year 6" },
        certainty: "confirmed",
        quote: discoText,
      },
    ],
    responsibilities: [],
  }),
  recordedCommunication({
    id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c13",
    receivedAt: "2026-01-16T16:00:00.000Z",
    subject: "Year 6 Science Museum trip",
    sourceText: museumTripText,
    claims: [
      {
        content: "Year 6 will visit the Science Museum on 27 January 2026.",
        audience: { scope: "group", originalWording: "Year 6" },
        certainty: "confirmed",
        date: { originalWording: "Tuesday 27 January", resolvedDate: "2026-01-27" },
        quote: "Year 6 visit the Science Museum on Tuesday 27 January.",
      },
      {
        content: "Sam's signed museum trip permission form is due by 23 January 2026.",
        audience: { scope: "child", originalWording: "Sam" },
        certainty: "confirmed",
        date: { originalWording: "Friday 23 January", resolvedDate: "2026-01-23" },
        quote: "Please return Sam's signed permission form by Friday 23 January.",
      },
    ],
    responsibilities: [
      {
        title: "Return Sam's museum trip permission form",
        dueDate: { originalWording: "Friday 23 January", resolvedDate: "2026-01-23" },
        claimPositions: [1],
      },
    ],
  }),
  recordedCommunication({
    id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c20",
    receivedAt: "2026-01-16T17:00:00.000Z",
    subject: "Year 2 bake sale",
    sourceText: bakeSaleText,
    claims: [
      {
        content: "Year 2 bake sale is on 30 January 2026.",
        audience: { scope: "group", originalWording: "Year 2" },
        certainty: "confirmed",
        date: { originalWording: "Friday 30 January", resolvedDate: "2026-01-30" },
        quote: "Year 2 bake sale is on Friday 30 January.",
      },
    ],
    responsibilities: [],
  }),
];
