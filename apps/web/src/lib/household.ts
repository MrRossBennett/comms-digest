import { z } from "zod";

const trimmedRequiredText = z.string().trim().min(1).max(100);

export const householdSetupSchema = z
  .object({
    schoolName: trimmedRequiredText,
    children: z
      .array(
        z
          .object({
            displayName: z.string().trim().min(1).max(50),
            schoolYear: z.string().trim().min(1).max(50),
            className: z
              .string()
              .trim()
              .max(50)
              .transform((value) => value || null)
              .nullable()
              .optional()
              .transform((value) => value ?? null),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();
