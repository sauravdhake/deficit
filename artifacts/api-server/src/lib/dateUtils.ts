import { query360Raw } from "./db360";

export function extractDateRange(query: Record<string, unknown>): {
  fromDate: string;
  toDate: string;
} {
  const today = new Date();
  
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const day = lastWeek.getDay();
  const diffToMonday = lastWeek.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(lastWeek);
  monday.setDate(diffToMonday);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const defaultFromStr = monday.toISOString().split("T")[0]!;
  const defaultToStr = friday.toISOString().split("T")[0]!;

  const rawFrom = query["dateFrom"];
  const rawTo = query["dateTo"];

  let fromDate = defaultFromStr;
  let toDate = defaultToStr;

  if (typeof rawFrom === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawFrom)) {
    fromDate = rawFrom.slice(0, 10);
  }
  if (typeof rawTo === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawTo)) {
    toDate = rawTo.slice(0, 10);
  }

  return { fromDate, toDate };
}

/**
 * Parse a "YYYY-MM-DD" string as a UTC Date to avoid timezone shifts.
 */
function parseUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

/**
 * Extract a UTC "YYYY-MM-DD" string from a Date or date string value coming
 * from the MySQL driver. mysql2 returns DATE columns as JS Date objects at
 * UTC midnight — toISOString() gives the correct calendar date regardless of
 * the server's local timezone.
 */
function toUTCDateString(raw: Date | string): string {
  const d = raw instanceof Date ? raw : new Date(raw);
  return d.toISOString().split("T")[0]!;
}

export function workingDaysSimple(from: string, to: string): number {
  let count = 0;
  const end = parseUTC(to);
  for (let d = parseUTC(from); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return Math.max(count, 1);
}

export async function workingDaysWithHolidays(
  from: string,
  to: string
): Promise<number> {
  try {
    const holidays = await query360Raw<{ holidays_date: Date | string }>(
      `SELECT holidays_date FROM holidays
       WHERE holidays_date BETWEEN ? AND ?
         AND optional_status = 0`,
      [from, to]
    );

    // Build holiday set using UTC date strings to avoid timezone shifts
    const holidayDates = new Set(
      holidays.map((h) => toUTCDateString(h.holidays_date))
    );

    let count = 0;
    const end = parseUTC(to);
    for (let d = parseUTC(from); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const day = d.getUTCDay();
      const dateStr = d.toISOString().split("T")[0]!;
      if (day !== 0 && day !== 6 && !holidayDates.has(dateStr)) {
        count++;
      }
    }
    return Math.max(count, 1);
  } catch {
    return workingDaysSimple(from, to);
  }
}

export async function getHolidaysInRange(from: string, to: string): Promise<Set<string>> {
  try {
    const holidays = await query360Raw<{ holidays_date: Date | string }>(
      `SELECT holidays_date FROM holidays
       WHERE holidays_date BETWEEN ? AND ?
         AND optional_status = 0`,
      [from, to]
    );
    // Use UTC-safe extraction so e.g. Christmas is always "2025-12-25"
    return new Set(holidays.map((h) => toUTCDateString(h.holidays_date)));
  } catch {
    return new Set();
  }
}

/**
 * Count working (non-weekend, non-holiday) days in [from, to].
 *
 * Exclusive-end-date rule:
 *   - If from === to  → 1 day (single-day leave)
 *   - If from  <  to  → to is EXCLUSIVE, so Dec 25-30 = Dec 25, 26, 27, 28, 29
 *
 * All date arithmetic is done in UTC to avoid timezone-induced day shifts.
 */
export function calcWorkingDaysSync(from: string, to: string, holidays: Set<string>): number {
  const DAY_MS = 86_400_000;
  const startMs = parseUTC(from).getTime();
  let endMs = parseUTC(to).getTime();

  if (startMs > endMs) return 0;

  // Exclusive end for multi-day spans
  if (from !== to) {
    endMs -= DAY_MS;
  }

  let count = 0;
  for (let ms = startMs; ms <= endMs; ms += DAY_MS) {
    const d = new Date(ms);
    const day = d.getUTCDay();
    const dateStr = d.toISOString().split("T")[0]!;
    if (day !== 0 && day !== 6 && !holidays.has(dateStr)) {
      count++;
    }
  }
  return count;
}
