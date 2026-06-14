import { describe, expect, test } from "vite-plus/test";

import {
  communicationSourceReviewSchema,
  hasGmailReadonlyScope,
  parseSender,
} from "./communication-source";

describe("Communication Source Review", () => {
  test("parses a named sender without retaining message content", () => {
    expect(parseSender('"Riverside Primary" <Office@Riverside.example>')).toEqual({
      senderName: "Riverside Primary",
      senderAddress: "office@riverside.example",
    });
    expect(parseSender("not an email")).toBeNull();
  });

  test("requires selected Children to have a School assignment", () => {
    expect(() =>
      communicationSourceReviewSchema.parse({
        sourceId: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c00",
        status: "confirmed",
        audience: "children",
        schoolId: null,
        childIds: [],
      }),
    ).toThrow();
  });

  test("accepts a Household-wide confirmed source", () => {
    expect(
      communicationSourceReviewSchema.parse({
        sourceId: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c00",
        status: "confirmed",
        audience: "household",
        schoolId: null,
        childIds: [],
      }),
    ).toEqual({
      sourceId: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97c00",
      status: "confirmed",
      audience: "household",
      schoolId: null,
      childIds: [],
    });
  });

  test("recognises Gmail read-only among additional Google scopes", () => {
    expect(
      hasGmailReadonlyScope("openid email https://www.googleapis.com/auth/gmail.readonly profile"),
    ).toBe(true);
    expect(
      hasGmailReadonlyScope(
        "https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/userinfo.email,openid",
      ),
    ).toBe(true);
    expect(hasGmailReadonlyScope("openid email profile")).toBe(false);
  });
});
