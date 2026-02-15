function padTwoDigits({ value }: { value: string }): string {
  if (value.length === 1) return `0${value}`;
  return value;
}

function parseIsoDatePortion({ isoString }: { isoString: string }): {
  year: string;
  month: string;
  day: string;
} {
  const datePortion = isoString.slice(0, 10);
  const parts = datePortion.split("-");

  if (parts.length !== 3) {
    throw new Error("Invalid ISO date format");
  }

  const [year, monthRaw, dayRaw] = parts;
  const month = padTwoDigits({ value: monthRaw });
  const day = padTwoDigits({ value: dayRaw });

  if (!year || !month || !day) {
    throw new Error("Invalid ISO date components");
  }

  return { year, month, day };
}

export function formatRctiWeekEndingShort({
  isoString,
}: {
  isoString: string;
}): string {
  const { year, month, day } = parseIsoDatePortion({ isoString });
  return `${day}.${month}.${year}`;
}

export function formatRctiWeekEndingLong({
  isoString,
}: {
  isoString: string;
}): string {
  const { year, month, day } = parseIsoDatePortion({ isoString });

  const monthNames: string[] = [
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

  const monthIndex = Number(month) - 1;
  const monthName = monthNames[monthIndex];

  if (!monthName) {
    throw new Error("Invalid month value in ISO date");
  }

  const dayWithoutLeadingZero = String(Number(day));
  return `${dayWithoutLeadingZero} ${monthName} ${year}`;
}

export function buildRctiEmailSubject({
  weekEndingIso,
  companyName,
}: {
  weekEndingIso: string;
  companyName: string | null;
}): string {
  const weekEndingFormatted = formatRctiWeekEndingShort({
    isoString: weekEndingIso,
  });
  const trimmedCompanyName = (companyName ?? "").trim();

  if (!trimmedCompanyName) {
    return `RCTI W/E ${weekEndingFormatted}`;
  }

  return `RCTI W/E ${weekEndingFormatted} from ${trimmedCompanyName}`;
}
