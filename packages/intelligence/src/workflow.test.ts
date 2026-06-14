import { expect, test } from "vite-plus/test";

import { schoolCommunicationSchema } from "./contracts";
import { createExtractionWorkflow } from "./workflow";

test("runs injected extraction and deterministic grounding as an explicit workflow", async () => {
  const sourceText =
    "Year 4 swimming starts next Monday. Please pay £12 by Friday for the lessons.";
  const swimmingQuote = "Year 4 swimming starts next Monday.";
  const paymentQuote = "Please pay £12 by Friday for the lessons.";
  const ids = [
    "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b02",
    "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b03",
    "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b04",
    "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b05",
    "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b06",
  ];
  const communication = schoolCommunicationSchema.parse({
    id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b01",
    kind: "email",
    receivedAt: "2026-01-12T16:30:00.000Z",
    householdTimezone: "Europe/London",
    subject: "Year 4 swimming",
    sourceText,
  });

  const workflow = createExtractionWorkflow({
    extract: async () => ({
      claims: [
        {
          content: "Year 4 swimming starts on 19 January 2026.",
          audience: { scope: "group", originalWording: "Year 4" },
          certainty: "confirmed",
          date: { originalWording: "next Monday", resolvedDate: "2026-01-19" },
          citations: [{ quote: swimmingQuote, start: 0, end: swimmingQuote.length }],
        },
        {
          content: "Payment of £12 is due by 16 January 2026.",
          audience: { scope: "group", originalWording: "Year 4" },
          certainty: "confirmed",
          date: { originalWording: "Friday", resolvedDate: "2026-01-16" },
          citations: [
            {
              quote: paymentQuote,
              start: sourceText.indexOf(paymentQuote),
              end: sourceText.indexOf(paymentQuote) + paymentQuote.length,
            },
          ],
        },
      ],
      responsibilities: [
        {
          title: "Pay £12 for Year 4 swimming",
          dueDate: { originalWording: "Friday", resolvedDate: "2026-01-16" },
          amount: { currency: "GBP", minorUnits: 1200 },
          claimPositions: [1],
        },
      ],
    }),
    createId: () => {
      const id = ids.shift();
      if (!id) throw new Error("Test ID sequence exhausted");
      return id;
    },
  });

  const result = await workflow.invoke({ communication });

  expect(result.validated?.responsibilities[0]).toMatchObject({
    title: "Pay £12 for Year 4 swimming",
    supportingClaimIds: ["018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b05"],
  });
  expect(result.validated?.claims).toHaveLength(2);
});

test("fails closed on an ungrounded Claim without failing the communication", async () => {
  const workflow = createExtractionWorkflow({
    extract: async () => ({
      claims: [
        {
          content: "Swimming is cancelled.",
          audience: { scope: "group", originalWording: "Year 4" },
          certainty: "confirmed",
          citations: [{ quote: "cancelled", start: 0, end: 9 }],
        },
      ],
      responsibilities: [],
    }),
  });

  const result = await workflow.invoke({
    communication: {
      id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b01",
      kind: "email",
      receivedAt: "2026-01-12T16:30:00.000Z",
      householdTimezone: "Europe/London",
      sourceText: "Swimming starts next Monday.",
    },
  });

  expect(result.validated?.claims).toEqual([]);
  expect(result.validated?.responsibilities).toEqual([]);
});
