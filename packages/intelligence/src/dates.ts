import * as chrono from "chrono-node";

export function resolveRelativeDate(
  originalWording: string,
  receivedAt: string,
  householdTimezone: string,
) {
  const wording = originalWording.trim();
  const referenceInstant = new Date(receivedAt);
  const timezone = getTimezoneOffsetMinutes(referenceInstant, householdTimezone);
  const results = chrono.en.GB.parse(
    wording,
    { instant: referenceInstant, timezone },
    { forwardDate: true },
  );
  const result = results.length === 1 ? results[0] : undefined;

  if (!result || result.index !== 0 || result.text.length !== wording.length) {
    return { originalWording, resolvedDate: null };
  }

  const year = result.start.get("year");
  const month = result.start.get("month");
  const day = result.start.get("day");
  if (year === null || month === null || day === null) {
    return { originalWording, resolvedDate: null };
  }

  const resolved = new Date(Date.UTC(year, month - 1, day));
  const statedWeekday = result.start.isCertain("weekday") ? result.start.get("weekday") : undefined;
  const isValidDate =
    resolved.getUTCFullYear() === year &&
    resolved.getUTCMonth() === month - 1 &&
    resolved.getUTCDate() === day;
  const isValidWeekday = statedWeekday === undefined || resolved.getUTCDay() === statedWeekday;

  return {
    originalWording,
    resolvedDate: isValidDate && isValidWeekday ? resolved.toISOString().slice(0, 10) : null,
  };
}

function getTimezoneOffsetMinutes(instant: Date, timezone: string) {
  const timeZoneName = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  })
    .formatToParts(instant)
    .find(({ type }) => type === "timeZoneName")?.value;

  if (timeZoneName === "GMT") return 0;

  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(timeZoneName ?? "");
  if (!match) {
    throw new Error(`Could not determine timezone offset for ${timezone}`);
  }

  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}
