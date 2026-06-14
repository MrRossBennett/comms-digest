const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

type GmailRequestDependencies = {
  request?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
};

export async function gmailRequest(
  url: string,
  accessToken: string,
  dependencies: GmailRequestDependencies = {},
) {
  const request = dependencies.request ?? fetch;
  const sleep =
    dependencies.sleep ??
    ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await request(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.ok) return response.json();

    if (!RETRYABLE_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS) {
      throw new Error(`Gmail request failed with status ${response.status}`);
    }

    const retryAfter = response.headers.get("retry-after");
    const retryAfterSeconds = retryAfter === null ? null : Number(retryAfter);
    const delayMilliseconds =
      retryAfterSeconds !== null && Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds * 1_000
        : 2 ** (attempt - 1) * 1_000;
    await sleep(delayMilliseconds);
  }

  throw new Error("Gmail request failed");
}
