import { eq } from "drizzle-orm";

import { getDb } from "../db";
import { userAutomationPreferences } from "../db/schema";

function parseAreas(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function preferenceAllowsPush(input: {
  userEmail: string;
  area: string;
  kind: string;
  createdAt?: Date;
}) {
  const [preference] = await getDb().select().from(userAutomationPreferences)
    .where(eq(userAutomationPreferences.userEmail, input.userEmail)).limit(1);
  if (!preference) return true;
  if (input.kind === "notification_digest") return preference.digestFrequency !== "off";
  if (preference.digestFrequency !== "immediate") return false;
  const areas = parseAreas(preference.notificationAreasJson);
  if (areas.length && !areas.includes(input.area)) return false;
  if (preference.criticalOnly && !/critical|failed|incident|overdue|blocked|verification/i.test(input.kind)) return false;
  if (preference.quietStart && preference.quietEnd) {
    const now = input.createdAt ?? new Date();
    const local = new Date(now.getTime() - preference.timezoneOffsetMinutes * 60_000);
    const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
    const [startHour, startMinute] = preference.quietStart.split(":").map(Number);
    const [endHour, endMinute] = preference.quietEnd.split(":").map(Number);
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    const quiet = start <= end ? minute >= start && minute < end : minute >= start || minute < end;
    if (quiet) return false;
  }
  return true;
}
