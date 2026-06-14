import { describe, expect, test, vi } from "vite-plus/test";

import { gmailRequest } from "./gmail";

describe("Gmail requests", () => {
  test("retries a rate-limited request with exponential backoff", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(Response.json({ messages: [] }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      gmailRequest("https://gmail.example/messages", "token", { request, sleep }),
    ).resolves.toEqual({ messages: [] });
    expect(request).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  test("does not retry a permanent Gmail error", async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      gmailRequest("https://gmail.example/messages", "token", { request, sleep }),
    ).rejects.toThrow("Gmail request failed with status 401");
    expect(request).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
