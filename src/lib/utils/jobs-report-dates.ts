const MELBOURNE_TZ = "Australia/Melbourne";

/**
 * Formats the date part of an ISO string as DD/MM/YYYY without timezone
 * conversion.
 */
export function formatDateDDMMYYYY({ isoString }: { isoString: string }): string {
  const parts = isoString.substring(0, 10).split("-");
  if (parts.length !== 3) return isoString;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Formats the date part of an ISO string as "D Month YYYY" without timezone
 * conversion.
 */
export function formatWeekEndingLong({ isoString }: { isoString: string }): string {
  const parts = isoString.substring(0, 10).split("-");
  if (parts.length !== 3) return isoString;
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthName = months[parseInt(parts[1], 10) - 1] ?? "";
  return `${parseInt(parts[2], 10)} ${monthName} ${parts[0]}`;
}

function pad2({ value }: { value: number }): string {
  return String(value).padStart(2, "0");
}

function isLeapYear({ year }: { year: number }): boolean {
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}

/**
 * Returns the number of days in a month (monthIndex is zero-based).
 */
export function getDaysInMonth({
  year,
  monthIndex,
}: {
  year: number;
  monthIndex: number;
}): number {
  const month = monthIndex + 1;
  if (month === 2) {
    return isLeapYear({ year }) ? 29 : 28;
  }

  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }

  return 31;
}

function getIsoDateParts({
  isoDate,
}: {
  isoDate: string;
}): { year: number; monthIndex: number; day: number } | null {
  const datePart = isoDate.substring(0, 10);
  const parts = datePart.split("-");
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  )
    return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > getDaysInMonth({ year, monthIndex: month - 1 }))
    return null;

  return { year, monthIndex: month - 1, day };
}

/**
 * Builds a YYYY-MM-DD string from its parts (monthIndex is zero-based).
 */
export function formatIsoDate({
  year,
  monthIndex,
  day,
}: {
  year: number;
  monthIndex: number;
  day: number;
}): string {
  return `${year}-${pad2({ value: monthIndex + 1 })}-${pad2({ value: day })}`;
}

/**
 * Adds (or subtracts) whole days to a YYYY-MM-DD date without using Date
 * objects, so no timezone conversion applies.
 */
export function addDaysToIsoDate({
  isoDate,
  days,
}: {
  isoDate: string;
  days: number;
}): string {
  const parsed = getIsoDateParts({ isoDate });
  if (!parsed) return isoDate.substring(0, 10);

  let year = parsed.year;
  let monthIndex = parsed.monthIndex;
  let day = parsed.day;
  let remaining = days;

  while (remaining > 0) {
    const daysInMonth = getDaysInMonth({ year, monthIndex });
    if (day < daysInMonth) {
      day++;
    } else {
      day = 1;
      if (monthIndex === 11) {
        monthIndex = 0;
        year++;
      } else {
        monthIndex++;
      }
    }
    remaining--;
  }

  while (remaining < 0) {
    if (day > 1) {
      day--;
    } else {
      if (monthIndex === 0) {
        monthIndex = 11;
        year--;
      } else {
        monthIndex--;
      }
      day = getDaysInMonth({ year, monthIndex });
    }
    remaining++;
  }

  return formatIsoDate({ year, monthIndex, day });
}

function getDayOfWeek({ isoDate }: { isoDate: string }): number {
  const parsed = getIsoDateParts({ isoDate });
  if (!parsed) return 0;

  let year = parsed.year;
  const month = parsed.monthIndex + 1;
  const day = parsed.day;
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  if (month < 3) year -= 1;
  return (
    (year +
      Math.floor(year / 4) -
      Math.floor(year / 100) +
      Math.floor(year / 400) +
      offsets[month - 1] +
      day) %
    7
  );
}

/**
 * Returns the Sunday that ends the week containing a YYYY-MM-DD date.
 */
export function getWeekEndingSundayIsoDate({ isoDate }: { isoDate: string }): string {
  const dayOfWeek = getDayOfWeek({ isoDate });
  const daysUntilSunday = (7 - dayOfWeek) % 7;
  return addDaysToIsoDate({ isoDate, days: daysUntilSunday });
}

/**
 * Returns today's date in Melbourne as YYYY-MM-DD.
 */
export function getMelbourneTodayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MELBOURNE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Builds the year, month and week-ending options for the jobs report period
 * controls from job dates, always including the selected year and month.
 */
export function getJobsReportPeriodOptions({
  jobs,
  selectedYear,
  selectedMonth,
}: {
  jobs: ReadonlyArray<{ date: string }>;
  selectedYear: number;
  selectedMonth: number;
}) {
  const yearSet = new Set<number>();
  yearSet.add(selectedYear);
  for (const j of jobs) {
    if (j.date) {
      const year = parseInt(j.date.substring(0, 4), 10);
      if (Number.isFinite(year)) yearSet.add(year);
    }
  }
  const years = Array.from(yearSet).sort((a, b) => a - b);

  const monthSet = new Set<number>();
  monthSet.add(selectedMonth);
  for (const j of jobs) {
    if (j.date && parseInt(j.date.substring(0, 4), 10) === selectedYear) {
      const monthIndex = parseInt(j.date.substring(5, 7), 10) - 1;
      if (monthIndex >= 0 && monthIndex <= 11) {
        monthSet.add(monthIndex);
      }
    }
  }
  const months = Array.from(monthSet).sort((a, b) => a - b);

  const weekEndingSet = new Set<string>();
  for (const j of jobs) {
    if (!j.date) continue;
    const weekEndingIso = getWeekEndingSundayIsoDate({
      isoDate: j.date.substring(0, 10),
    });
    if (
      parseInt(weekEndingIso.substring(0, 4), 10) === selectedYear &&
      parseInt(weekEndingIso.substring(5, 7), 10) - 1 === selectedMonth
    ) {
      weekEndingSet.add(weekEndingIso);
    }
  }
  const weekEndings = Array.from(weekEndingSet).sort((a, b) =>
    a.localeCompare(b),
  );

  return { years, months, weekEndings };
}
