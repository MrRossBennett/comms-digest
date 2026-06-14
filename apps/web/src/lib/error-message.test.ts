import { expect, test } from "vite-plus/test";

import { getErrorMessage } from "./error-message";

test("extracts useful messages from nested server and provider errors", () => {
  expect(getErrorMessage({ error: { data: { message: "Provider rate limit" } } }, "Fallback")).toBe(
    "Provider rate limit",
  );
  expect(
    getErrorMessage(
      new Error("[object Object]", { cause: { message: "Structured output failed" } }),
      "Fallback",
    ),
  ).toBe("Structured output failed");
});

test("uses the fallback for opaque objects and circular error shapes", () => {
  const circular: { cause?: unknown } = {};
  circular.cause = circular;

  expect(getErrorMessage({}, "Clear fallback")).toBe("Clear fallback");
  expect(getErrorMessage(circular, "Clear fallback")).toBe("Clear fallback");
});
