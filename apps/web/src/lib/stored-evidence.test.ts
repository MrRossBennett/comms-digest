import { validatedExtractionSchema } from "@repo/intelligence";
import { describe, expect, test } from "vite-plus/test";

import { fromStoredEvidenceRows, toStoredEvidenceRows } from "./stored-evidence";

describe("Stored Evidence mapping", () => {
  test("round-trips a validated extraction and re-resolves stale stored dates", () => {
    const sourceText =
      "Mia's museum visit is on Wednesday 24 June. Please return the signed form by Friday 19 June. The trip costs GBP 12.50.";
    const extraction = validatedExtractionSchema.parse({
      communication: {
        id: "10000000-0000-4000-8000-000000000001",
        kind: "email",
        schoolId: "10000000-0000-4000-8000-000000000002",
        sourceChildIds: [
          "10000000-0000-4000-8000-000000000003",
          "10000000-0000-4000-8000-000000000004",
        ],
        receivedAt: "2026-06-12T15:30:00.000Z",
        householdTimezone: "Europe/London",
        subject: "Museum visit",
        sourceText,
      },
      claims: [
        {
          id: "20000000-0000-4000-8000-000000000001",
          content: "Mia's museum visit is on 24 June 2026.",
          audience: { scope: "child", originalWording: "Mia" },
          certainty: "confirmed",
          date: { originalWording: "Wednesday 24 June", resolvedDate: "2026-06-24" },
          citations: [
            {
              id: "30000000-0000-4000-8000-000000000001",
              communicationId: "10000000-0000-4000-8000-000000000001",
              quote: "Mia's museum visit is on Wednesday 24 June.",
              start: 0,
              end: 48,
            },
          ],
        },
        {
          id: "20000000-0000-4000-8000-000000000002",
          content: "The signed form is due by 19 June 2026.",
          audience: { scope: "household", originalWording: "families" },
          certainty: "tentative",
          citations: [
            {
              id: "30000000-0000-4000-8000-000000000002",
              communicationId: "10000000-0000-4000-8000-000000000001",
              quote: "Please return the signed form by Friday 19 June.",
              start: 49,
              end: 99,
            },
          ],
        },
      ],
      responsibilities: [
        {
          id: "40000000-0000-4000-8000-000000000001",
          title: "Return the signed museum visit form",
          dueDate: { originalWording: "Friday 19 June", resolvedDate: "2026-06-19" },
          amount: { currency: "GBP", minorUnits: 1250 },
          supportingClaimIds: [
            "20000000-0000-4000-8000-000000000001",
            "20000000-0000-4000-8000-000000000002",
          ],
        },
      ],
    });

    const rows = toStoredEvidenceRows(extraction, {
      householdId: "50000000-0000-4000-8000-000000000001",
      communicationSourceId: "50000000-0000-4000-8000-000000000002",
      sourceAudience: "children",
      externalMessageId: "message-1",
      senderAddress: "office@school.test",
    });

    expect(fromStoredEvidenceRows(rows)).toEqual(extraction);

    rows.claims[0]!.dateResolved = "2026-01-01";
    rows.responsibilities[0]!.dueDateResolved = "2026-01-02";

    expect(fromStoredEvidenceRows(rows)).toEqual(extraction);
  });
});
