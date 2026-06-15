import { z } from "zod";

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) => {
    const addressDomain = value.includes("@") ? value.slice(value.lastIndexOf("@") + 1) : value;
    return addressDomain.replace(/^\.+|\.+$/g, "");
  })
  .pipe(
    z
      .string()
      .min(3, "Enter a valid email domain")
      .max(253, "Enter a valid email domain")
      .regex(
        /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
        "Enter a valid email domain",
      ),
  );

export const communicationSourceCreateSchema = z
  .object({
    senderDomain: domainSchema,
  })
  .strict();

export const communicationSourceReviewSchema = z
  .object({
    sourceId: z.uuid(),
    status: z.enum(["confirmed", "rejected"]),
    audience: z.enum(["household", "school", "children"]),
    schoolId: z.uuid().nullable(),
    childIds: z.array(z.uuid()).max(12),
  })
  .strict()
  .superRefine((review, context) => {
    if (review.status === "rejected") return;

    if (review.audience === "household") {
      if (review.schoolId || review.childIds.length > 0) {
        context.addIssue({
          code: "custom",
          message: "Household sources cannot be assigned to a School or individual Students",
        });
      }
      return;
    }

    if (!review.schoolId) {
      context.addIssue({
        code: "custom",
        path: ["schoolId"],
        message: "Choose a School",
      });
    }

    if (review.audience === "school" && review.childIds.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["childIds"],
        message: "School sources cannot also select individual Students",
      });
    }

    if (review.audience === "children" && review.childIds.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["childIds"],
        message: "Choose at least one Student",
      });
    }
  });

export function parseSender(value: string) {
  const angleAddress = value.match(/^(.*?)<([^<>]+)>$/);
  const senderName = angleAddress?.[1]?.trim().replace(/^["']|["']$/g, "");
  const senderAddress = (angleAddress?.[2] ?? value).trim().toLocaleLowerCase("en-GB");

  if (!z.email().safeParse(senderAddress).success) return null;

  return {
    senderName: senderName || senderAddress,
    senderAddress,
    senderDomain: domainSchema.parse(senderAddress),
  };
}

export function parseSenderDomain(value: string) {
  const result = domainSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function hasGmailReadonlyScope(scope: string | null) {
  return scope?.split(/[\s,]+/).includes("https://www.googleapis.com/auth/gmail.readonly") ?? false;
}
