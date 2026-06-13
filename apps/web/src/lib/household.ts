import { z } from "zod";

const trimmedRequiredText = z.string().trim().min(1).max(100);

export const householdSetupSchema = z
  .object({
    schools: z
      .array(
        z
          .object({
            key: z.string().trim().min(1).max(100),
            name: trimmedRequiredText,
          })
          .strict(),
      )
      .min(1)
      .max(8),
    children: z
      .array(
        z
          .object({
            key: z.string().trim().min(1).max(100),
            displayName: z.string().trim().min(1).max(50),
            schoolYear: z.string().trim().min(1).max(50),
            schoolKey: z.string().trim().min(1).max(100),
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
  .strict()
  .superRefine((setup, context) => {
    const schoolKeys = new Set(setup.schools.map(({ key }) => key));
    if (schoolKeys.size !== setup.schools.length) {
      context.addIssue({
        code: "custom",
        path: ["schools"],
        message: "Each School needs a unique key",
      });
    }

    const childKeys = new Set(setup.children.map(({ key }) => key));
    if (childKeys.size !== setup.children.length) {
      context.addIssue({
        code: "custom",
        path: ["children"],
        message: "Each Child needs a unique key",
      });
    }

    setup.children.forEach((householdChild, index) => {
      if (!schoolKeys.has(householdChild.schoolKey)) {
        context.addIssue({
          code: "custom",
          path: ["children", index, "schoolKey"],
          message: "Each Child must be assigned to a School in the Household",
        });
      }
    });
  });
