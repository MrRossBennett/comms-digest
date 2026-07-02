import type { DayPlan, DayPlanEntry } from "./day-plan";

const GSM_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);
const GSM_EXTENSION = new Set("^{}\\[~]|€");
const SEGMENT_LIMIT = 160;

export type DayPlanMessageResult =
  | { outcome: "skipped_empty" }
  | { outcome: "composed"; body: string; segmentUnits: number };

export function composeDayPlanMessage(dayPlan: DayPlan, deepLink: string): DayPlanMessageResult {
  const entries = deliverableEntries(dayPlan);
  if (entries.length === 0) return { outcome: "skipped_empty" };

  const safeLink = toGsmText(deepLink);
  const fallback = `For tomorrow: View your Day Plan: ${safeLink}`;
  if (gsm7Units(fallback) > SEGMENT_LIMIT) {
    throw new Error("Day Plan deep link cannot fit in one GSM-7 segment");
  }

  const count = `${entries.length} ${entries.length === 1 ? "item" : "items"}`;
  const prefix = `For tomorrow: ${count}. First: `;
  const suffix = `. Full plan: ${safeLink}`;
  const availableTitleUnits = SEGMENT_LIMIT - gsm7Units(prefix) - gsm7Units(suffix);
  const title = truncateGsm(toGsmText(entries[0]?.title ?? ""), availableTitleUnits);
  const body = title ? `${prefix}${title}${suffix}` : fallback;

  return { outcome: "composed", body, segmentUnits: gsm7Units(body) };
}

export function gsm7Units(value: string) {
  let units = 0;
  for (const character of value) {
    if (GSM_BASIC.has(character)) units += 1;
    else if (GSM_EXTENSION.has(character)) units += 2;
    else return Number.POSITIVE_INFINITY;
  }
  return units;
}

function deliverableEntries(dayPlan: DayPlan): DayPlanEntry[] {
  return [...dayPlan.overdue, ...dayPlan.today, ...dayPlan.comingUp];
}

function toGsmText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(
      /[^@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[\]~|€]/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function truncateGsm(value: string, maxUnits: number) {
  if (maxUnits <= 0) return "";
  if (gsm7Units(value) <= maxUnits) return value;

  const ellipsis = "...";
  let result = "";
  for (const character of value) {
    if (gsm7Units(result + character + ellipsis) > maxUnits) break;
    result += character;
  }
  return `${result.trimEnd()}${ellipsis}`;
}
