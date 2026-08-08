// Time / date formatting helpers.
//
// Why this file exists:
//   SQLite's `datetime('now')` returns a UTC string WITHOUT a timezone
//   marker (e.g. `"2026-08-08 03:16:00"`). The same value is also sometimes
//   written via `new Date().toISOString()`, which IS a UTC string but WITH
//   the `Z` suffix. The two shapes parse differently in JS:
//     - `"2026-08-08 03:16:00"`     -> parsed as browser LOCAL time
//     - `"2026-08-08T03:16:00.000Z"` -> parsed as UTC, then localised
//   In a UTC container the two happen to print the same wall-clock digits,
//   but on a host running in Asia/Shanghai the first form is silently
//   off by 8 hours.
//
//   To avoid that whole class of bug, every place that shows a stored
//   timestamp to a user MUST go through this file, and MUST pass
//   `timeZone: 'Asia/Shanghai'`. The product is targeted at Chinese
//   users and the rest of the UI (e.g. `Intl.DateTimeFormat('zh-CN')`
//   defaults) is already in CST, so we pin the whole stack to
//   Asia/Shanghai rather than trying to be clever.

const BEIJING_TZ = 'Asia/Shanghai';

/**
 * Parse a stored timestamp string into a `Date` that the JS Date
 * constructor will interpret as the same instant the server wrote.
 *
 * Accepts all three shapes we actually emit from the backend:
 *   1. `"2026-08-08 03:16:00"`         — SQLite `datetime('now')` (UTC, no Z)
 *   2. `"2026-08-08T03:16:00.000Z"`    — `new Date().toISOString()` (UTC, with Z)
 *   3. `"2026-08-08T03:16:00.000+00:00"`— explicit-offset ISO (UTC)
 *   4. A number (milliseconds since epoch) — passed through.
 *
 * The first shape is the dangerous one: `new Date("2026-08-08 03:16:00")`
 * treats the missing offset as LOCAL time, so on a Beijing host the
 * stored UTC instant is reinterpreted as Beijing 03:16 instead of the
 * correct Beijing 11:16. We rewrite the bare form to the ISO-Z form
 * before handing it to the Date constructor.
 */
export function parseStoredTimestamp(
  value: string | number | null | undefined,
): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(value).trim();
  if (!s) return null;
  // Bare "YYYY-MM-DD HH:mm:ss" — assume UTC, add the Z.
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    const iso = s.includes('T') ? s : s.replace(' ', 'T');
    return new Date(`${iso}Z`);
  }
  // Anything else (ISO with Z, ISO with offset, already a Date string,
  // a number-as-string, etc.) — let the Date constructor handle it.
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Format a stored timestamp in Asia/Shanghai using the given Intl options.
 * Returns the fallback when the input is empty or unparseable.
 */
export function formatInBeijing(
  value: string | number | null | undefined,
  options: Intl.DateTimeFormatOptions,
  fallback = '—',
): string {
  const d = parseStoredTimestamp(value);
  if (!d) return fallback;
  try {
    return d.toLocaleString('zh-CN', { timeZone: BEIJING_TZ, ...options });
  } catch {
    return fallback;
  }
}

/** `YYYY/MM/DD HH:mm` in Asia/Shanghai. */
export function formatDateTimeBeijing(
  value: string | number | null | undefined,
  fallback = '—',
): string {
  return formatInBeijing(
    value,
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    },
    fallback,
  );
}

/** `YYYY/MM/DD` in Asia/Shanghai. */
export function formatDateBeijing(
  value: string | number | null | undefined,
  fallback = '—',
): string {
  return formatInBeijing(
    value,
    { year: 'numeric', month: '2-digit', day: '2-digit' },
    fallback,
  );
}
