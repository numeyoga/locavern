/**
 * Pure, timezone-drift-free helpers for ISO calendar dates (YYYY-MM-DD).
 * All arithmetic uses UTC timestamps derived exclusively from calendar year/month/day
 * so DST transitions and local UTC offsets never shift dates by +-1 day.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** @type {readonly string[]} */
export const WEEKDAY_SHORT_FR = Object.freeze(['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']);

/** @type {readonly string[]} */
const MONTH_NAMES_FR = Object.freeze([
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]);

/** @type {readonly string[]} */
const MONTH_SHORT_FR = Object.freeze([
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
]);

/**
 * Parse a strict YYYY-MM-DD calendar date string into validated calendar parts.
 * @param {string | null | undefined} value
 * @returns {{ year: number; month: number; day: number } | null}
 */
export function parseIsoDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() + 1 !== month ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * Format numeric calendar parts into YYYY-MM-DD.
 * @param {number} year
 * @param {number} month 1..12
 * @param {number} day 1..31
 * @returns {string}
 */
export function formatIsoDate(year, month, day) {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Return today's local wall-clock calendar date as YYYY-MM-DD.
 * @param {Date} [now]
 * @returns {string}
 */
export function getTodayIsoDate(now = new Date()) {
  return formatIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * Shift a YYYY-MM-DD calendar date by `deltaDays` (positive or negative).
 * @param {string} isoDate
 * @param {number} deltaDays
 * @returns {string}
 */
export function shiftIsoDate(isoDate, deltaDays) {
  const parts = parseIsoDate(isoDate);
  if (!parts) return isoDate;
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day) + Math.trunc(deltaDays) * DAY_MS;
  const next = new Date(utc);
  return formatIsoDate(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

/**
 * Add `deltaMonths` to a YYYY-MM-DD date, clamping the day of month to the target month's length.
 * @param {string} isoDate
 * @param {number} deltaMonths
 * @returns {string}
 */
export function addMonthsClamped(isoDate, deltaMonths) {
  const parts = parseIsoDate(isoDate);
  if (!parts) return isoDate;
  const totalMonths = parts.year * 12 + (parts.month - 1) + Math.trunc(deltaMonths);
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (((totalMonths % 12) + 12) % 12) + 1;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const targetDay = Math.min(parts.day, lastDayOfTargetMonth);
  return formatIsoDate(targetYear, targetMonth, targetDay);
}

/**
 * Compute the next dueDate (YYYY-MM-DD) for a recurring task upon completion.
 * Uses `dueDate` as anchor when valid, falling back to `todayIso`.
 * @param {string | null | undefined} dueDate
 * @param {'daily' | 'weekly' | 'monthly' | null | undefined} recurrence
 * @param {string} [todayIso]
 * @returns {string | null}
 */
export function computeNextRecurrenceDueDate(dueDate, recurrence, todayIso = getTodayIsoDate()) {
  if (recurrence !== 'daily' && recurrence !== 'weekly' && recurrence !== 'monthly') {
    return null;
  }
  const base = parseIsoDate(dueDate)
    ? /** @type {string} */ (dueDate)
    : parseIsoDate(todayIso)
      ? todayIso
      : getTodayIsoDate();
  if (recurrence === 'daily') return shiftIsoDate(base, 1);
  if (recurrence === 'weekly') return shiftIsoDate(base, 7);
  return addMonthsClamped(base, 1);
}

/**
 * Return 0-based ISO weekday (0 = Monday, 6 = Sunday).
 * @param {string} isoDate
 * @returns {number}
 */
export function getIsoWeekdayMon0(isoDate) {
  const parts = parseIsoDate(isoDate);
  if (!parts) return 0;
  const utcDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return (utcDay + 6) % 7;
}

/**
 * Return the Monday YYYY-MM-DD of the week containing `isoDate`.
 * @param {string} isoDate
 * @returns {string}
 */
export function getWeekStartIsoDate(isoDate) {
  return shiftIsoDate(isoDate, -getIsoWeekdayMon0(isoDate));
}

/**
 * Return signed calendar-day difference (`b - a`) between two YYYY-MM-DD dates.
 * @param {string} aIsoDate
 * @param {string} bIsoDate
 * @returns {number}
 */
export function diffIsoDays(aIsoDate, bIsoDate) {
  const a = parseIsoDate(aIsoDate);
  const b = parseIsoDate(bIsoDate);
  if (!a || !b) return 0;
  const utcA = Date.UTC(a.year, a.month - 1, a.day);
  const utcB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((utcB - utcA) / DAY_MS);
}

/**
 * Build the Monday-to-Sunday calendar grid for a given year and month (1..12).
 * @param {number} year
 * @param {number} month 1..12
 * @returns {Array<{ date: string; day: number; month: number; year: number; inCurrentMonth: boolean; weekdayIndex: number }>}
 */
export function buildMonthCalendarGrid(year, month) {
  const firstIso = formatIsoDate(year, month, 1);
  const leadingDays = getIsoWeekdayMon0(firstIso);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const totalCells = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  const gridStartIso = shiftIsoDate(firstIso, -leadingDays);

  /** @type {Array<{ date: string; day: number; month: number; year: number; inCurrentMonth: boolean; weekdayIndex: number }>} */
  const cells = [];
  for (let i = 0; i < totalCells; i += 1) {
    const date = shiftIsoDate(gridStartIso, i);
    const parts = parseIsoDate(date);
    if (!parts) continue;
    cells.push({
      date,
      day: parts.day,
      month: parts.month,
      year: parts.year,
      inCurrentMonth: parts.year === year && parts.month === month,
      weekdayIndex: i % 7,
    });
  }
  return cells;
}

/**
 * Build the 7-day Monday-to-Sunday week containing `anchorIsoDate`.
 * @param {string} anchorIsoDate
 * @returns {Array<{ date: string; day: number; month: number; year: number; weekdayIndex: number; weekdayLabel: string }>}
 */
export function buildWeekCalendarGrid(anchorIsoDate) {
  const startIso = getWeekStartIsoDate(anchorIsoDate);
  /** @type {Array<{ date: string; day: number; month: number; year: number; weekdayIndex: number; weekdayLabel: string }>} */
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const date = shiftIsoDate(startIso, i);
    const parts = parseIsoDate(date);
    if (!parts) continue;
    days.push({
      date,
      day: parts.day,
      month: parts.month,
      year: parts.year,
      weekdayIndex: i,
      weekdayLabel: WEEKDAY_SHORT_FR[i] ?? '',
    });
  }
  return days;
}

/**
 * Format "Mois AAAA" in French sentence case.
 * @param {number} year
 * @param {number} month 1..12
 * @returns {string}
 */
export function formatMonthYearLabel(year, month) {
  const name = MONTH_NAMES_FR[month - 1] ?? '';
  return `${name} ${year}`;
}

/**
 * Format a compact French date label like "15 nov." or "15 nov. 2026".
 * @param {string} isoDate
 * @param {boolean} [withYear]
 * @returns {string}
 */
export function formatShortDateFr(isoDate, withYear = false) {
  const parts = parseIsoDate(isoDate);
  if (!parts) return isoDate;
  const monthLabel = MONTH_SHORT_FR[parts.month - 1] ?? String(parts.month);
  return withYear ? `${parts.day} ${monthLabel} ${parts.year}` : `${parts.day} ${monthLabel}`;
}

/**
 * Classify a task dueDate relative to todayIso ('overdue' | 'today' | 'this_week' | 'later' | null).
 * Returns null for missing dates or completed ('done') tasks.
 * @param {string | null | undefined} dueDate
 * @param {string} todayIso
 * @param {string | null} [status]
 * @returns {'overdue' | 'today' | 'this_week' | 'later' | null}
 */
export function classifyDueDateUrgency(dueDate, todayIso, status = null) {
  if (!dueDate || status === 'done') return null;
  if (!parseIsoDate(dueDate) || !parseIsoDate(todayIso)) return null;
  const delta = diffIsoDays(todayIso, dueDate);
  if (delta < 0) return 'overdue';
  if (delta === 0) return 'today';
  if (delta <= 6) return 'this_week';
  return 'later';
}

/** @type {readonly string[]} */
const WEEKDAY_LONG_FR = Object.freeze([
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
]);

/** @type {readonly string[]} */
const MONTH_LOWER_FR = Object.freeze([
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]);

/**
 * Format a full French calendar date like "Dimanche 15 novembre 2026".
 * @param {string} isoDate
 * @returns {string}
 */
export function formatFullDateFr(isoDate) {
  const parts = parseIsoDate(isoDate);
  if (!parts) return isoDate;
  const weekday = WEEKDAY_LONG_FR[getIsoWeekdayMon0(isoDate)] ?? '';
  const monthName = MONTH_LOWER_FR[parts.month - 1] ?? String(parts.month);
  return `${weekday} ${parts.day} ${monthName} ${parts.year}`;
}
