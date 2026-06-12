const weekdayIndexes = new Map([
  ["sunday", 0],
  ["monday", 1],
  ["tuesday", 2],
  ["wednesday", 3],
  ["thursday", 4],
  ["friday", 5],
  ["saturday", 6],
]);

const monthIndexes = new Map([
  ["january", 0],
  ["february", 1],
  ["march", 2],
  ["april", 3],
  ["may", 4],
  ["june", 5],
  ["july", 6],
  ["august", 7],
  ["september", 8],
  ["october", 9],
  ["november", 10],
  ["december", 11],
]);

export function resolveRelativeDate(
  originalWording: string,
  receivedAt: string,
  householdTimezone: string,
) {
  const dateParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: householdTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(receivedAt));
  const values = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
  const localDate = new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)),
  );

  const weekdayMatch =
    /^(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.exec(
      originalWording.trim(),
    );
  if (weekdayMatch) {
    return resolveWeekday(originalWording, localDate, weekdayMatch);
  }

  const statedDateMatch =
    /^(?:(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+)?(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)$/i.exec(
      originalWording.trim(),
    );
  if (statedDateMatch) {
    return resolveStatedDate(originalWording, localDate, statedDateMatch);
  }

  return { originalWording, resolvedDate: null };
}

function resolveWeekday(originalWording: string, localDate: Date, match: RegExpExecArray) {
  const targetWeekday = weekdayIndexes.get(match[2]?.toLowerCase() ?? "");
  if (targetWeekday === undefined) {
    throw new Error(`Unsupported weekday: ${originalWording}`);
  }

  let daysAhead = (targetWeekday - localDate.getUTCDay() + 7) % 7;
  if (match[1] && daysAhead === 0) {
    daysAhead = 7;
  }
  localDate.setUTCDate(localDate.getUTCDate() + daysAhead);

  return {
    originalWording,
    resolvedDate: localDate.toISOString().slice(0, 10),
  };
}

function resolveStatedDate(originalWording: string, localDate: Date, match: RegExpExecArray) {
  const day = Number(match[2]);
  const month = monthIndexes.get(match[3]?.toLowerCase() ?? "");
  if (month === undefined) {
    return { originalWording, resolvedDate: null };
  }

  const candidates = [-1, 0, 1].map(
    (yearOffset) => new Date(Date.UTC(localDate.getUTCFullYear() + yearOffset, month, day)),
  );
  const candidate = candidates.reduce((closest, current) =>
    Math.abs(current.getTime() - localDate.getTime()) <
    Math.abs(closest.getTime() - localDate.getTime())
      ? current
      : closest,
  );
  const statedWeekday = match[1] ? weekdayIndexes.get(match[1].toLowerCase()) : undefined;
  const isValidDate = candidate.getUTCMonth() === month && candidate.getUTCDate() === day;
  const isValidWeekday = statedWeekday === undefined || candidate.getUTCDay() === statedWeekday;

  return {
    originalWording,
    resolvedDate: isValidDate && isValidWeekday ? candidate.toISOString().slice(0, 10) : null,
  };
}
