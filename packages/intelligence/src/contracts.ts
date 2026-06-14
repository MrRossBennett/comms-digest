import { z } from "zod";

const ianaTimezoneSchema = z.string().refine(
  (value) => {
    try {
      new Intl.DateTimeFormat("en-GB", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  },
  { message: "Expected an IANA timezone" },
);

export const schoolCommunicationSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(["email"]),
    schoolId: z.uuid().nullable().optional(),
    sourceChildIds: z.array(z.uuid()).optional(),
    receivedAt: z.iso.datetime({ offset: true }),
    householdTimezone: ianaTimezoneSchema,
    subject: z.string().min(1).optional(),
    sourceText: z
      .string()
      .min(1)
      .refine((value) => !value.includes("\r"), {
        message: "School Communication source text must be normalized",
      }),
  })
  .strict();

export const audienceSchema = z
  .object({
    scope: z.enum(["child", "group", "school", "household", "unresolved"]),
    originalWording: z.string().min(1),
  })
  .strict();

export const dateReferenceSchema = z
  .object({
    originalWording: z.string().min(1),
    resolvedDate: z.iso.date().nullable(),
  })
  .strict();

export const amountSchema = z
  .object({
    currency: z.string().length(3),
    minorUnits: z.int().nonnegative(),
  })
  .strict();

export const modelCitationSchema = z
  .object({
    quote: z.string().min(1),
    start: z.int().nonnegative(),
    end: z.int().positive(),
  })
  .strict();

export const modelClaimSchema = z
  .object({
    content: z.string().min(1),
    audience: audienceSchema,
    certainty: z.enum(["confirmed", "tentative", "unclear_needs_review", "contradicted"]),
    date: dateReferenceSchema.optional(),
    citations: z.array(modelCitationSchema).min(1),
  })
  .strict();

export const modelResponsibilitySchema = z
  .object({
    title: z.string().min(1),
    dueDate: dateReferenceSchema.optional(),
    amount: amountSchema.optional(),
    claimPositions: z.array(z.int().nonnegative()).min(1),
  })
  .strict();

export const modelExtractionSchema = z
  .object({
    claims: z.array(modelClaimSchema),
    responsibilities: z.array(modelResponsibilitySchema),
  })
  .strict();

export const citationSchema = modelCitationSchema.extend({
  id: z.uuid(),
  communicationId: z.uuid(),
});

export const claimSchema = modelClaimSchema.omit({ citations: true }).extend({
  id: z.uuid(),
  citations: z.array(citationSchema).min(1),
});

export const responsibilitySchema = modelResponsibilitySchema
  .omit({ claimPositions: true })
  .extend({
    id: z.uuid(),
    supportingClaimIds: z.array(z.uuid()).min(1),
  });

export const validatedExtractionSchema = z
  .object({
    communication: schoolCommunicationSchema,
    claims: z.array(claimSchema),
    responsibilities: z.array(responsibilitySchema),
  })
  .strict();

export type SchoolCommunication = z.infer<typeof schoolCommunicationSchema>;
export type ModelExtraction = z.infer<typeof modelExtractionSchema>;
export type ValidatedExtraction = z.infer<typeof validatedExtractionSchema>;
