import { describe, expect, test } from "vite-plus/test";

import { isRootCauseReauth } from "./sync-error";

describe("isRootCauseReauth", () => {
  test("returns true when error carries needsReauth flag", () => {
    const err = Object.assign(new Error("Gmail read failed"), { needsReauth: true });
    expect(isRootCauseReauth(err)).toBe(true);
  });

  test("returns true for revoked token message", () => {
    expect(isRootCauseReauth(new Error("Token revoked by user"))).toBe(true);
  });

  test("returns true for invalid_grant message", () => {
    expect(isRootCauseReauth(new Error("invalid_grant"))).toBe(true);
  });

  test("returns true for token expired message", () => {
    expect(isRootCauseReauth(new Error("token expired"))).toBe(true);
  });

  test("returns true for unauthorized message", () => {
    expect(isRootCauseReauth(new Error("unauthorized"))).toBe(true);
  });

  test("returns false for transient Gmail errors", () => {
    expect(isRootCauseReauth(new Error("Gmail 503 Service Unavailable"))).toBe(false);
    expect(isRootCauseReauth(new Error("Network timeout"))).toBe(false);
    expect(isRootCauseReauth(new Error("Rate limit exceeded"))).toBe(false);
  });

  test("returns false for non-Error values", () => {
    expect(isRootCauseReauth("string error")).toBe(false);
    expect(isRootCauseReauth(null)).toBe(false);
    expect(isRootCauseReauth(undefined)).toBe(false);
  });
});
