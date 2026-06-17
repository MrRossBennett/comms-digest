import * as chrono from "chrono-node";

/**
 * Leading words a School Communication routinely puts in front of a deadline date, e.g.
 * "by 17 July 2026" or "due on Friday". They qualify the date rather than adding a separate
 * fact, so we let them precede the parsed date while still rejecting wording where the date is
 * buried in an instruction sentence (e.g. "Please return this Monday"), which we cannot trust.
 */
const DEADLINE_QUALIFIER_PREFIXES = new Set([
  "by",
  "by the",
  "on",
  "before",
  "after",
  "due",
  "due by",
  "due on",
  "no later than",
  "by no later than",
  "from",
  "starting",
  "starting on",
  "starts",
  "until",
  "week commencing",
  "w/c",
]);

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

  if (!result) {
    return { originalWording, resolvedDate: null };
  }

  const prefix = wording.slice(0, result.index).trim().toLowerCase().replace(/\s+/gu, " ");
  const reachesEnd = result.index + result.text.length === wording.length;
  const hasAllowedPrefix = prefix.length === 0 || DEADLINE_QUALIFIER_PREFIXES.has(prefix);

  if (!reachesEnd || !hasAllowedPrefix) {
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

export function todayInTimezone(timezone: string, now: Date) {
  const offsetMinutes = getTimezoneOffsetMinutes(now, timezone);
  const localInstant = new Date(now.getTime() + offsetMinutes * 60_000);
  return localInstant.toISOString().slice(0, 10);
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
