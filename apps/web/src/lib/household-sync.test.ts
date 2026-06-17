import { describe, expect, test } from "vite-plus/test";

import { needsReauthFromSyncState } from "./household-sync";

describe("needsReauthFromSyncState", () => {
  test("returns false when there is no sync record yet", () => {
    expect(needsReauthFromSyncState(null)).toBe(false);
  });

  test("returns false when Gmail is connected and healthy", () => {
    expect(needsReauthFromSyncState({ needsReauth: false })).toBe(false);
  });

  test("returns true when Gmail access was revoked while the user was away", () => {
    expect(needsReauthFromSyncState({ needsReauth: true })).toBe(true);
  });
});
