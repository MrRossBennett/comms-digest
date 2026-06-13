import { digestGroundTruthSchema } from "./benchmark";
import { schoolCommunicationSchema, validatedExtractionSchema } from "./contracts";
import { digestSchema, householdDigestConfigSchema, reconciliationSchema } from "./digest";

const alexId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c01";
const samId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c12";
const announcementId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c02";
const announcementEventClaimId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c03";
const announcementEventCitationId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c04";
const announcementPaymentClaimId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c05";
const announcementPaymentCitationId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c06";
const announcementResponsibilityId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c07";
const reminderId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c08";
const reminderClaimId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c09";
const reminderCitationId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c0a";
const reminderResponsibilityId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c0b";
const cancellationId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c0c";
const cancellationClaimId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c0d";
const cancellationCitationId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c0e";
const year6Id = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c0f";
const year6ClaimId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c10";
const year6CitationId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c11";
const museumTripId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c13";
const museumTripClaimId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c14";
const museumTripCitationId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c15";
const permissionFormClaimId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c16";
const permissionFormCitationId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c17";
const permissionFormResponsibilityId = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c18";

function citation(communicationId: string, id: string, sourceText: string, quote: string) {
  const start = sourceText.indexOf(quote);
  return { id, communicationId, quote, start, end: start + quote.length };
}

function communication(id: string, receivedAt: string, subject: string, sourceText: string) {
  return schoolCommunicationSchema.parse({
    id,
    kind: "email",
    receivedAt,
    householdTimezone: "Europe/London",
    subject,
    sourceText,
  });
}

const announcementText =
  "Year 4 swimming starts on Monday 19 January. Please pay £12 by Friday 16 January.";
const announcementEventQuote = "Year 4 swimming starts on Monday 19 January.";
const announcementPaymentQuote = "Please pay £12 by Friday 16 January.";
const reminderText = "Reminder for Year 4 families: please pay £12 for swimming by Friday.";
const reminderQuote = "please pay £12 for swimming by Friday.";
const cancellationText = "Year 4 swimming on Monday 19 January has been cancelled.";
const cancellationQuote = cancellationText;
const year6Text = "Year 6 disco tickets are now available.";
const year6Quote = year6Text;
const museumTripText =
  "Year 6 visit the Science Museum on Tuesday 27 January. Please return Sam's signed permission form by Friday 23 January.";
const museumTripQuote = "Year 6 visit the Science Museum on Tuesday 27 January.";
const permissionFormQuote = "Please return Sam's signed permission form by Friday 23 January.";

const extractions = [
  validatedExtractionSchema.parse({
    communication: communication(
      announcementId,
      "2026-01-12T16:30:00.000Z",
      "Year 4 swimming",
      announcementText,
    ),
    claims: [
      {
        id: announcementEventClaimId,
        content: "Year 4 swimming starts on 19 January 2026.",
        audience: { scope: "group", originalWording: "Year 4" },
        certainty: "confirmed",
        date: { originalWording: "Monday 19 January", resolvedDate: "2026-01-19" },
        citations: [
          citation(
            announcementId,
            announcementEventCitationId,
            announcementText,
            announcementEventQuote,
          ),
        ],
      },
      {
        id: announcementPaymentClaimId,
        content: "Year 4 swimming payment of £12 is due by 16 January 2026.",
        audience: { scope: "group", originalWording: "Year 4" },
        certainty: "confirmed",
        date: { originalWording: "Friday 16 January", resolvedDate: "2026-01-16" },
        citations: [
          citation(
            announcementId,
            announcementPaymentCitationId,
            announcementText,
            announcementPaymentQuote,
          ),
        ],
      },
    ],
    responsibilities: [
      {
        id: announcementResponsibilityId,
        title: "Pay £12 for Year 4 swimming",
        dueDate: { originalWording: "Friday 16 January", resolvedDate: "2026-01-16" },
        amount: { currency: "GBP", minorUnits: 1200 },
        supportingClaimIds: [announcementPaymentClaimId],
      },
    ],
  }),
  validatedExtractionSchema.parse({
    communication: communication(
      reminderId,
      "2026-01-14T16:30:00.000Z",
      "Swimming payment reminder",
      reminderText,
    ),
    claims: [
      {
        id: reminderClaimId,
        content: "Year 4 swimming payment of £12 remains due by 16 January 2026.",
        audience: { scope: "group", originalWording: "Year 4 families" },
        certainty: "confirmed",
        date: { originalWording: "Friday", resolvedDate: "2026-01-16" },
        citations: [citation(reminderId, reminderCitationId, reminderText, reminderQuote)],
      },
    ],
    responsibilities: [
      {
        id: reminderResponsibilityId,
        title: "Pay £12 for Year 4 swimming",
        dueDate: { originalWording: "Friday", resolvedDate: "2026-01-16" },
        amount: { currency: "GBP", minorUnits: 1200 },
        supportingClaimIds: [reminderClaimId],
      },
    ],
  }),
  validatedExtractionSchema.parse({
    communication: communication(
      cancellationId,
      "2026-01-15T16:30:00.000Z",
      "Swimming cancelled",
      cancellationText,
    ),
    claims: [
      {
        id: cancellationClaimId,
        content: "Year 4 swimming on 19 January 2026 has been cancelled.",
        audience: { scope: "group", originalWording: "Year 4" },
        certainty: "confirmed",
        date: { originalWording: "Monday 19 January", resolvedDate: "2026-01-19" },
        citations: [
          citation(cancellationId, cancellationCitationId, cancellationText, cancellationQuote),
        ],
      },
    ],
    responsibilities: [],
  }),
  validatedExtractionSchema.parse({
    communication: communication(year6Id, "2026-01-15T17:00:00.000Z", "Year 6 disco", year6Text),
    claims: [
      {
        id: year6ClaimId,
        content: "Year 6 disco tickets are available.",
        audience: { scope: "group", originalWording: "Year 6" },
        certainty: "confirmed",
        citations: [citation(year6Id, year6CitationId, year6Text, year6Quote)],
      },
    ],
    responsibilities: [],
  }),
  validatedExtractionSchema.parse({
    communication: communication(
      museumTripId,
      "2026-01-16T16:00:00.000Z",
      "Year 6 Science Museum trip",
      museumTripText,
    ),
    claims: [
      {
        id: museumTripClaimId,
        content: "Year 6 will visit the Science Museum on 27 January 2026.",
        audience: { scope: "group", originalWording: "Year 6" },
        certainty: "confirmed",
        date: { originalWording: "Tuesday 27 January", resolvedDate: "2026-01-27" },
        citations: [citation(museumTripId, museumTripCitationId, museumTripText, museumTripQuote)],
      },
      {
        id: permissionFormClaimId,
        content: "Sam's signed museum trip permission form is due by 23 January 2026.",
        audience: { scope: "child", originalWording: "Sam" },
        certainty: "confirmed",
        date: { originalWording: "Friday 23 January", resolvedDate: "2026-01-23" },
        citations: [
          citation(museumTripId, permissionFormCitationId, museumTripText, permissionFormQuote),
        ],
      },
    ],
    responsibilities: [
      {
        id: permissionFormResponsibilityId,
        title: "Return Sam's museum trip permission form",
        dueDate: { originalWording: "Friday 23 January", resolvedDate: "2026-01-23" },
        supportingClaimIds: [permissionFormClaimId],
      },
    ],
  }),
];

export const multiCommunicationScenario = {
  household: householdDigestConfigSchema.parse({
    children: [
      { id: alexId, name: "Alex", schoolYear: "Year 4" },
      { id: samId, name: "Sam", schoolYear: "Year 6" },
    ],
  }),
  extractions,
  reconciliation: reconciliationSchema.parse({
    items: [
      {
        section: "act_now",
        title: "Return Sam's museum trip permission form",
        claimIds: [permissionFormClaimId],
        responsibilityIds: [permissionFormResponsibilityId],
      },
      {
        section: "coming_up",
        title: "Sam's Year 6 museum trip",
        claimIds: [museumTripClaimId],
        responsibilityIds: [],
      },
      {
        section: "good_to_know",
        title: "Year 4 swimming has been cancelled",
        claimIds: [
          announcementEventClaimId,
          announcementPaymentClaimId,
          reminderClaimId,
          cancellationClaimId,
        ],
        responsibilityIds: [announcementResponsibilityId, reminderResponsibilityId],
      },
      {
        section: "good_to_know",
        title: "Year 6 disco tickets are available",
        claimIds: [year6ClaimId],
        responsibilityIds: [],
      },
    ],
  }),
};

const claimsById = new Map(
  extractions.flatMap(({ claims }) => claims).map((claim) => [claim.id, claim]),
);
const responsibilitiesById = new Map(
  extractions
    .flatMap(({ responsibilities }) => responsibilities)
    .map((responsibility) => [responsibility.id, responsibility]),
);

function requireClaim(id: string) {
  const claim = claimsById.get(id);
  if (!claim) throw new Error(`Scenario is missing Claim ${id}`);
  return claim;
}

function requireResponsibility(id: string) {
  const responsibility = responsibilitiesById.get(id);
  if (!responsibility) throw new Error(`Scenario is missing Responsibility ${id}`);
  return responsibility;
}

export const multiCommunicationBenchmark = {
  scenario: {
    household: multiCommunicationScenario.household,
    extractions: multiCommunicationScenario.extractions,
  },
  pipelineReconciliation: multiCommunicationScenario.reconciliation,
  expected: digestGroundTruthSchema.parse({
    items: [
      {
        section: "act_now",
        title: "Return Sam's museum trip permission form",
        childIds: [samId],
      },
      {
        section: "coming_up",
        title: "Sam's Year 6 museum trip",
        childIds: [samId],
      },
      {
        section: "good_to_know",
        title: "Year 4 swimming has been cancelled",
        childIds: [alexId],
      },
      {
        section: "good_to_know",
        title: "Year 6 disco tickets are available",
        childIds: [samId],
      },
    ],
  }),
  naive: digestSchema.parse({
    actNow: [
      {
        title: "Pay £12 for Year 4 swimming",
        childIds: [alexId],
        claims: [requireClaim(announcementPaymentClaimId)],
        responsibilities: [requireResponsibility(announcementResponsibilityId)],
      },
      {
        title: "Remember to pay for swimming",
        childIds: [alexId],
        claims: [requireClaim(reminderClaimId)],
        responsibilities: [requireResponsibility(reminderResponsibilityId)],
      },
    ],
    comingUp: [
      {
        title: "Year 4 swimming starts on 19 January",
        childIds: [alexId],
        claims: [requireClaim(announcementEventClaimId)],
        responsibilities: [],
      },
    ],
    goodToKnow: [
      {
        title: "Year 6 disco tickets are available",
        childIds: [alexId],
        claims: [requireClaim(year6ClaimId)],
        responsibilities: [],
      },
    ],
  }),
};
