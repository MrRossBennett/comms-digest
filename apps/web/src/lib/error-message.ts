const errorDetailKeys = ["message", "error", "cause", "data"] as const;

export function getErrorMessage(error: unknown, fallback: string) {
  return findErrorMessage(error, new Set(), 0) ?? fallback;
}

function findErrorMessage(error: unknown, seen: Set<object>, depth: number): string | undefined {
  if (depth > 4) return undefined;

  if (typeof error === "string") {
    const message = error.trim();
    return message && message !== "[object Object]" ? message : undefined;
  }

  if (!error || typeof error !== "object" || seen.has(error)) return undefined;
  seen.add(error);

  for (const key of errorDetailKeys) {
    const message = findErrorMessage(Reflect.get(error, key), seen, depth + 1);
    if (message) return message;
  }

  return undefined;
}
