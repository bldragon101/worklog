import type { Job } from "@/lib/types";

export type SplitAttachmentType = "runsheet" | "docket" | "delivery_photos";

export type PageSuggestionReason = "matched" | "continuation" | "sequential";

export interface PageAssignment {
  pageIndex: number;
  jobId: number | null;
  attachmentType: SplitAttachmentType;
  reason: PageSuggestionReason | null;
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const DATE_SCORE = 3;
const DRIVER_SCORE = 2;
const CUSTOMER_SCORE = 1;
const WEEKDAY_SCORE = 1;

/**
 * Reads the calendar date from a job's date string (YYYY-MM-DD or a full ISO
 * string) without any timezone conversion.
 */
export function getJobDateParts({ date }: { date: string }): {
  year: number;
  month: number;
  day: number;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function normaliseText({ text }: { text: string }): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Finds every calendar date written on a page in Australian day-first order
 * (e.g. 27/10/2026, 27.10.26, 27-10-2026) or ISO order (2026-10-27).
 */
export function extractDatesFromText({ text }: { text: string }): string[] {
  const found = new Set<string>();

  const dayFirst = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g;
  for (const match of text.matchAll(dayFirst)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const rawYear = match[3];
    const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      found.add(formatDateKey({ year, month, day }));
    }
  }

  const isoOrder = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
  for (const match of text.matchAll(isoOrder)) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      found.add(formatDateKey({ year, month, day }));
    }
  }

  return Array.from(found);
}

function formatDateKey({
  year,
  month,
  day,
}: {
  year: number;
  month: number;
  day: number;
}): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getWeekdayName({ date }: { date: string }): string | null {
  const parts = getJobDateParts({ date });
  if (!parts) return null;
  const monthOffsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const year = parts.month < 3 ? parts.year - 1 : parts.year;
  const dayIndex =
    (year +
      Math.floor(year / 4) -
      Math.floor(year / 100) +
      Math.floor(year / 400) +
      monthOffsets[parts.month - 1] +
      parts.day) %
    7;
  return WEEKDAYS[dayIndex];
}

function containsWord({
  haystack,
  needle,
}: {
  haystack: string;
  needle: string;
}): boolean {
  if (needle.length < 2) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(haystack);
}

function nameMatches({
  haystack,
  name,
}: {
  haystack: string;
  name: string;
}): boolean {
  const normalisedName = normaliseText({ text: name });
  if (!normalisedName) return false;
  if (containsWord({ haystack, needle: normalisedName })) return true;

  const tokens = normalisedName.split(" ").filter((token) => token.length >= 3);
  if (tokens.length < 2) return false;
  return tokens.every((token) => containsWord({ haystack, needle: token }));
}

/**
 * Scores how strongly a page's text points at a job. A written date match is
 * the strongest signal, then the driver's name, then customer and weekday.
 */
export function scorePageForJob({
  text,
  job,
}: {
  text: string;
  job: Job;
}): number {
  const haystack = normaliseText({ text });
  if (!haystack) return 0;

  let score = 0;
  const parts = getJobDateParts({ date: job.date });
  if (parts) {
    const jobDateKey = formatDateKey(parts);
    if (extractDatesFromText({ text: haystack }).includes(jobDateKey)) {
      score += DATE_SCORE;
    }
  }

  if (job.driver && nameMatches({ haystack, name: job.driver })) {
    score += DRIVER_SCORE;
  }

  if (job.customer && nameMatches({ haystack, name: job.customer })) {
    score += CUSTOMER_SCORE;
  }

  const weekday = getWeekdayName({ date: job.date });
  if (weekday && containsWord({ haystack, needle: weekday })) {
    score += WEEKDAY_SCORE;
  }

  return score;
}

/**
 * Picks the job a page best matches, or null when nothing matches or two jobs
 * tie for the top score.
 */
export function findBestJobForPage({
  text,
  jobs,
}: {
  text: string;
  jobs: Job[];
}): number | null {
  let bestJobId: number | null = null;
  let bestScore = 0;
  let isTied = false;

  for (const job of jobs) {
    const score = scorePageForJob({ text, job });
    if (score > bestScore) {
      bestScore = score;
      bestJobId = job.id;
      isTied = false;
    } else if (score > 0 && score === bestScore) {
      isTied = true;
    }
  }

  return isTied ? null : bestJobId;
}

/**
 * Orders jobs by date, then driver, then ID, matching how a weekly runsheet
 * PDF is usually assembled.
 */
export function sortJobsForPageOrder({ jobs }: { jobs: Job[] }): Job[] {
  return [...jobs].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    const driverCompare = (a.driver || "").localeCompare(b.driver || "");
    if (driverCompare !== 0) return driverCompare;
    return a.id - b.id;
  });
}

/**
 * Suggests a job and attachment type for each page of a combined PDF.
 *
 * - A page whose text identifies a job is suggested as that job's runsheet.
 * - A page with no match that follows an assigned page is treated as a docket
 *   for the same job (multi-page dockets usually trail the runsheet).
 * - When no page text matches at all (e.g. a scanned PDF) and there is exactly
 *   one page per job, pages are mapped to jobs in date order.
 *
 * Every suggestion is shown to the user to confirm or change before upload.
 */
export function suggestPageAssignments({
  pageTexts,
  jobs,
}: {
  pageTexts: string[];
  jobs: Job[];
}): PageAssignment[] {
  const matchedJobIds = pageTexts.map((text) =>
    findBestJobForPage({ text, jobs }),
  );
  const hasAnyMatch = matchedJobIds.some((jobId) => jobId !== null);

  if (!hasAnyMatch && pageTexts.length === jobs.length) {
    const orderedJobs = sortJobsForPageOrder({ jobs });
    return pageTexts.map((_, pageIndex) => ({
      pageIndex,
      jobId: orderedJobs[pageIndex].id,
      attachmentType: "runsheet",
      reason: "sequential",
    }));
  }

  const assignments: PageAssignment[] = [];
  let previousJobId: number | null = null;

  for (let pageIndex = 0; pageIndex < pageTexts.length; pageIndex++) {
    const matchedJobId = matchedJobIds[pageIndex];

    if (matchedJobId !== null) {
      const isRepeatOfPrevious = matchedJobId === previousJobId;
      assignments.push({
        pageIndex,
        jobId: matchedJobId,
        attachmentType: isRepeatOfPrevious
          ? assignments[pageIndex - 1].attachmentType
          : "runsheet",
        reason: "matched",
      });
      previousJobId = matchedJobId;
      continue;
    }

    if (previousJobId !== null) {
      assignments.push({
        pageIndex,
        jobId: previousJobId,
        attachmentType: "docket",
        reason: "continuation",
      });
      continue;
    }

    assignments.push({
      pageIndex,
      jobId: null,
      attachmentType: "runsheet",
      reason: null,
    });
  }

  return assignments;
}

export interface PageGroup {
  jobId: number;
  attachmentType: SplitAttachmentType;
  pageIndexes: number[];
}

/**
 * Groups assigned pages into one output file per job and attachment type,
 * keeping the original page order. Unassigned pages are skipped.
 */
export function groupPageAssignments({
  assignments,
}: {
  assignments: PageAssignment[];
}): PageGroup[] {
  const groups = new Map<string, PageGroup>();

  for (const assignment of assignments) {
    if (assignment.jobId === null) continue;
    const key = `${assignment.jobId}::${assignment.attachmentType}`;
    const group = groups.get(key);
    if (group) {
      group.pageIndexes.push(assignment.pageIndex);
    } else {
      groups.set(key, {
        jobId: assignment.jobId,
        attachmentType: assignment.attachmentType,
        pageIndexes: [assignment.pageIndex],
      });
    }
  }

  for (const group of groups.values()) {
    group.pageIndexes.sort((a, b) => a - b);
  }

  return Array.from(groups.values());
}

/**
 * Describes page indexes as 1-based ranges, e.g. [0, 1, 2, 5] -> "p1-3_p6".
 */
export function formatPageRanges({
  pageIndexes,
}: {
  pageIndexes: number[];
}): string {
  const sorted = [...pageIndexes].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (current === end + 1) {
      end = current;
      continue;
    }
    ranges.push(start === end ? `p${start + 1}` : `p${start + 1}-${end + 1}`);
    start = current;
    end = current;
  }

  return ranges.join("_");
}
