/**
 * The National Day skin is deliberately time-boxed.  The dates include the
 * whole of 2 September in Vietnam (UTC+07:00), after which the existing home
 * banner is shown without requiring another release.
 */
export const NATIONAL_DAY_THEME_START = new Date('2026-08-29T00:00:00+07:00');
export const NATIONAL_DAY_THEME_END = new Date('2026-09-03T00:00:00+07:00');

export function isNationalDayThemeActive(now = new Date()) {
  return now >= NATIONAL_DAY_THEME_START && now < NATIONAL_DAY_THEME_END;
}
