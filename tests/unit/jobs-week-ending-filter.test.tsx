import { Job } from "@/lib/types";
import {
  startOfWeek,
  endOfWeek,
  endOfMonth,
  isWithinInterval,
  parseISO,
  getYear,
  getMonth,
  format,
} from "date-fns";

// Mock job data spanning December 2025 and January 2026
const mockJobsAcrossYearBoundary: Job[] = [
  {
    id: 1,
    date: "2025-12-28", // Sunday - last day of week ending Dec 28
    driver: "John Doe",
    customer: "ABC Company",
    billTo: "ABC Company",
    registration: "ABC123",
    truckType: "Tray",
    pickup: "123 Main St",
    dropoff: "456 Oak Ave",
    runsheet: true,
    invoiced: false,
    chargedHours: 8.0,
    driverCharge: 350.0,
    startTime: "08:00",
    finishTime: "16:00",
    comments: null,
    jobReference: "JOB-001",
    eastlink: 0,
    citylink: 0,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  },
  {
    id: 2,
    date: "2025-12-29", // Monday - start of week ending Jan 4, 2026
    driver: "Jane Smith",
    customer: "XYZ Corp",
    billTo: "XYZ Corp",
    registration: "XYZ789",
    truckType: "Crane",
    pickup: "789 First Ave",
    dropoff: "321 Second St",
    runsheet: true,
    invoiced: false,
    chargedHours: 6.0,
    driverCharge: 280.0,
    startTime: "09:00",
    finishTime: "15:00",
    comments: null,
    jobReference: "JOB-002",
    eastlink: 0,
    citylink: 0,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  },
  {
    id: 3,
    date: "2025-12-30", // Tuesday - part of week ending Jan 4, 2026
    driver: "John Doe",
    customer: "ABC Company",
    billTo: "ABC Company",
    registration: "ABC123",
    truckType: "Tray",
    pickup: "123 Main St",
    dropoff: "456 Oak Ave",
    runsheet: true,
    invoiced: false,
    chargedHours: 7.5,
    driverCharge: 320.0,
    startTime: "07:30",
    finishTime: "15:00",
    comments: null,
    jobReference: "JOB-003",
    eastlink: 0,
    citylink: 0,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  },
  {
    id: 4,
    date: "2025-12-31", // Wednesday - part of week ending Jan 4, 2026
    driver: "Jane Smith",
    customer: "XYZ Corp",
    billTo: "XYZ Corp",
    registration: "XYZ789",
    truckType: "Crane",
    pickup: "789 First Ave",
    dropoff: "321 Second St",
    runsheet: true,
    invoiced: false,
    chargedHours: 5.0,
    driverCharge: 220.0,
    startTime: "10:00",
    finishTime: "15:00",
    comments: null,
    jobReference: "JOB-004",
    eastlink: 0,
    citylink: 0,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  },
  {
    id: 5,
    date: "2026-01-01", // Thursday - part of week ending Jan 4, 2026
    driver: "John Doe",
    customer: "ABC Company",
    billTo: "ABC Company",
    registration: "ABC123",
    truckType: "Tray",
    pickup: "123 Main St",
    dropoff: "456 Oak Ave",
    runsheet: false,
    invoiced: false,
    chargedHours: 4.0,
    driverCharge: 180.0,
    startTime: "08:00",
    finishTime: "12:00",
    comments: "New Year's Day",
    jobReference: "JOB-005",
    eastlink: 0,
    citylink: 0,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  },
  {
    id: 6,
    date: "2026-01-02", // Friday - part of week ending Jan 4, 2026
    driver: "Jane Smith",
    customer: "XYZ Corp",
    billTo: "XYZ Corp",
    registration: "XYZ789",
    truckType: "Crane",
    pickup: "789 First Ave",
    dropoff: "321 Second St",
    runsheet: true,
    invoiced: false,
    chargedHours: 8.0,
    driverCharge: 350.0,
    startTime: "08:00",
    finishTime: "16:00",
    comments: null,
    jobReference: "JOB-006",
    eastlink: 0,
    citylink: 0,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  },
  {
    id: 7,
    date: "2026-01-04", // Sunday - last day of week ending Jan 4, 2026
    driver: "John Doe",
    customer: "ABC Company",
    billTo: "ABC Company",
    registration: "ABC123",
    truckType: "Tray",
    pickup: "123 Main St",
    dropoff: "456 Oak Ave",
    runsheet: true,
    invoiced: false,
    chargedHours: 6.0,
    driverCharge: 260.0,
    startTime: "09:00",
    finishTime: "15:00",
    comments: null,
    jobReference: "JOB-007",
    eastlink: 0,
    citylink: 0,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  },
  {
    id: 8,
    date: "2026-01-05", // Monday - start of week ending Jan 11, 2026
    driver: "Jane Smith",
    customer: "XYZ Corp",
    billTo: "XYZ Corp",
    registration: "XYZ789",
    truckType: "Crane",
    pickup: "789 First Ave",
    dropoff: "321 Second St",
    runsheet: true,
    invoiced: false,
    chargedHours: 8.0,
    driverCharge: 350.0,
    startTime: "08:00",
    finishTime: "16:00",
    comments: null,
    jobReference: "JOB-008",
    eastlink: 0,
    citylink: 0,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  },
];

const SHOW_MONTH = "__SHOW_MONTH__";

/**
 * Calculates week endings for a selected year and month.
 * A week ending should only appear if the week ending date itself is in the selected year AND month.
 */
function getWeekEndingsForMonth({
  jobs,
  selectedYear,
  selectedMonth,
}: {
  jobs: Job[];
  selectedYear: number;
  selectedMonth: number;
}): Date[] {
  const weekEndingsSet = new Set<string>();

  for (const job of jobs) {
    const jobDate = parseISO(job.date);
    const weekEnd = endOfWeek(jobDate, { weekStartsOn: 1 });

    // Only include week endings where the week ending date matches the selected year AND month
    if (
      getYear(weekEnd) === selectedYear &&
      getMonth(weekEnd) === selectedMonth
    ) {
      weekEndingsSet.add(format(weekEnd, "yyyy-MM-dd"));
    }
  }

  return Array.from(weekEndingsSet)
    .map((dateStr) => parseISO(dateStr))
    .sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Filters jobs based on selected year, month, and week ending.
 * When a specific week is selected, jobs from the entire week are shown,
 * even if they cross month or year boundaries.
 */
function filterJobs({
  jobs,
  selectedYear,
  selectedMonth,
  weekEnding,
}: {
  jobs: Job[];
  selectedYear: number;
  selectedMonth: number;
  weekEnding: Date | string;
}): Job[] {
  return jobs.filter((job) => {
    if (!job.date) return false;
    const jobDate = parseISO(job.date);

    // If showing whole month, filter by year and month
    if (weekEnding === SHOW_MONTH) {
      const yearMatch = getYear(jobDate) === selectedYear;
      const monthMatch = getMonth(jobDate) === selectedMonth;
      return yearMatch && monthMatch;
    }

    // If showing specific week, only filter by the week interval
    // This allows entries from previous month/year to show if they're within the selected week
    const weekStart = startOfWeek(weekEnding as Date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekEnding as Date, { weekStartsOn: 1 });
    return isWithinInterval(jobDate, { start: weekStart, end: weekEnd });
  });
}

describe("Jobs Week Ending Filter", () => {
  describe("getWeekEndingsForMonth", () => {
    it("should only show week endings that fall within December 2025", () => {
      const weekEndings = getWeekEndingsForMonth({
        jobs: mockJobsAcrossYearBoundary,
        selectedYear: 2025,
        selectedMonth: 11, // December (0-indexed)
      });

      // December 2025 should only have week ending Dec 28
      // The Jan 4, 2026 week ending should NOT appear in December
      expect(weekEndings).toHaveLength(1);
      expect(format(weekEndings[0], "yyyy-MM-dd")).toBe("2025-12-28");
    });

    it("should only show week endings that fall within January 2026", () => {
      const weekEndings = getWeekEndingsForMonth({
        jobs: mockJobsAcrossYearBoundary,
        selectedYear: 2026,
        selectedMonth: 0, // January (0-indexed)
      });

      // January 2026 should have week endings Jan 4 and Jan 11
      expect(weekEndings).toHaveLength(2);
      expect(format(weekEndings[0], "yyyy-MM-dd")).toBe("2026-01-04");
      expect(format(weekEndings[1], "yyyy-MM-dd")).toBe("2026-01-11");
    });

    it("should NOT show Jan 4, 2026 week ending when December 2025 is selected", () => {
      const weekEndings = getWeekEndingsForMonth({
        jobs: mockJobsAcrossYearBoundary,
        selectedYear: 2025,
        selectedMonth: 11, // December
      });

      const hasJan4 = weekEndings.some(
        (we) => format(we, "yyyy-MM-dd") === "2026-01-04",
      );
      expect(hasJan4).toBe(false);
    });

    it("should return empty array when no jobs exist in the selected month", () => {
      const weekEndings = getWeekEndingsForMonth({
        jobs: mockJobsAcrossYearBoundary,
        selectedYear: 2025,
        selectedMonth: 5, // June - no jobs
      });

      expect(weekEndings).toHaveLength(0);
    });
  });

  describe("filterJobs - Cross-year week filtering", () => {
    it("should show December 2025 jobs when Jan 4, 2026 week ending is selected", () => {
      const jan4WeekEnding = parseISO("2026-01-04");

      const filtered = filterJobs({
        jobs: mockJobsAcrossYearBoundary,
        selectedYear: 2026,
        selectedMonth: 0, // January
        weekEnding: jan4WeekEnding,
      });

      // Should include jobs from Dec 29, 30, 31 (2025) and Jan 1, 2, 4 (2026)
      // Job IDs: 2, 3, 4 (Dec 2025) and 5, 6, 7 (Jan 2026)
      expect(filtered).toHaveLength(6);

      const filteredDates = filtered.map((j) => j.date).sort();
      expect(filteredDates).toContain("2025-12-29");
      expect(filteredDates).toContain("2025-12-30");
      expect(filteredDates).toContain("2025-12-31");
      expect(filteredDates).toContain("2026-01-01");
      expect(filteredDates).toContain("2026-01-02");
      expect(filteredDates).toContain("2026-01-04");
    });

    it("should NOT include jobs from outside the selected week", () => {
      const jan4WeekEnding = parseISO("2026-01-04");

      const filtered = filterJobs({
        jobs: mockJobsAcrossYearBoundary,
        selectedYear: 2026,
        selectedMonth: 0,
        weekEnding: jan4WeekEnding,
      });

      // Should NOT include Dec 28 (different week) or Jan 5 (different week)
      const filteredDates = filtered.map((j) => j.date);
      expect(filteredDates).not.toContain("2025-12-28");
      expect(filteredDates).not.toContain("2026-01-05");
    });

    it("should only show December 2025 jobs when Dec 28 week ending is selected", () => {
      const dec28WeekEnding = parseISO("2025-12-28");

      const filtered = filterJobs({
        jobs: mockJobsAcrossYearBoundary,
        selectedYear: 2025,
        selectedMonth: 11, // December
        weekEnding: dec28WeekEnding,
      });

      // Week ending Dec 28 is Mon Dec 22 - Sun Dec 28
      // Only job ID 1 (Dec 28) is in this week from our test data
      expect(filtered).toHaveLength(1);
      expect(filtered[0].date).toBe("2025-12-28");
    });
  });

  describe("filterJobs - Show whole month", () => {
    it("should show only December 2025 jobs when showing whole month", () => {
      const filtered = filterJobs({
        jobs: mockJobsAcrossYearBoundary,
        selectedYear: 2025,
        selectedMonth: 11, // December
        weekEnding: SHOW_MONTH,
      });

      // Should include Dec 28, 29, 30, 31 (job IDs 1, 2, 3, 4)
      expect(filtered).toHaveLength(4);
      expect(filtered.every((j) => j.date.startsWith("2025-12"))).toBe(true);
    });

    it("should show only January 2026 jobs when showing whole month", () => {
      const filtered = filterJobs({
        jobs: mockJobsAcrossYearBoundary,
        selectedYear: 2026,
        selectedMonth: 0, // January
        weekEnding: SHOW_MONTH,
      });

      // Should include Jan 1, 2, 4, 5 (job IDs 5, 6, 7, 8)
      expect(filtered).toHaveLength(4);
      expect(filtered.every((j) => j.date.startsWith("2026-01"))).toBe(true);
    });

    it("should NOT show January 2026 jobs when December 2025 whole month is selected", () => {
      const filtered = filterJobs({
        jobs: mockJobsAcrossYearBoundary,
        selectedYear: 2025,
        selectedMonth: 11, // December
        weekEnding: SHOW_MONTH,
      });

      const hasJan2026Jobs = filtered.some((j) => j.date.startsWith("2026"));
      expect(hasJan2026Jobs).toBe(false);
    });
  });

  describe("filterJobs - Week boundaries", () => {
    it("should use Monday as the start of the week", () => {
      const jan4WeekEnding = parseISO("2026-01-04"); // Sunday
      const weekStart = startOfWeek(jan4WeekEnding, { weekStartsOn: 1 });

      // Week start should be Monday Dec 29, 2025
      expect(format(weekStart, "yyyy-MM-dd")).toBe("2025-12-29");
      expect(format(weekStart, "EEEE")).toBe("Monday");
    });

    it("should use Sunday as the end of the week", () => {
      const dec29 = parseISO("2025-12-29"); // Monday
      const weekEnd = endOfWeek(dec29, { weekStartsOn: 1 });

      // Week end should be Sunday Jan 4, 2026
      expect(format(weekEnd, "yyyy-MM-dd")).toBe("2026-01-04");
      expect(format(weekEnd, "EEEE")).toBe("Sunday");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty job list", () => {
      const weekEndings = getWeekEndingsForMonth({
        jobs: [],
        selectedYear: 2025,
        selectedMonth: 11,
      });

      expect(weekEndings).toHaveLength(0);
    });

    it("should handle filtering with empty job list", () => {
      const filtered = filterJobs({
        jobs: [],
        selectedYear: 2025,
        selectedMonth: 11,
        weekEnding: parseISO("2025-12-28"),
      });

      expect(filtered).toHaveLength(0);
    });

    it("should handle jobs with no date", () => {
      const jobsWithNullDate = [
        ...mockJobsAcrossYearBoundary,
        {
          ...mockJobsAcrossYearBoundary[0],
          id: 99,
          date: "",
        },
      ];

      const filtered = filterJobs({
        jobs: jobsWithNullDate,
        selectedYear: 2025,
        selectedMonth: 11,
        weekEnding: SHOW_MONTH,
      });

      // Should not include the job with empty date
      expect(filtered.find((j) => j.id === 99)).toBeUndefined();
    });

    it("should correctly handle the last week of any year crossing into next year", () => {
      // This is the core bug fix - ensure jobs from Dec 2025 show in Jan 2026 week
      const jan4WeekEnding = parseISO("2026-01-04");

      const filtered = filterJobs({
        jobs: mockJobsAcrossYearBoundary,
        selectedYear: 2026,
        selectedMonth: 0,
        weekEnding: jan4WeekEnding,
      });

      // Count jobs from each year
      const dec2025Jobs = filtered.filter((j) => j.date.startsWith("2025-12"));
      const jan2026Jobs = filtered.filter((j) => j.date.startsWith("2026-01"));

      expect(dec2025Jobs.length).toBeGreaterThan(0);
      expect(jan2026Jobs.length).toBeGreaterThan(0);
      expect(dec2025Jobs.length + jan2026Jobs.length).toBe(filtered.length);
    });
  });

  describe("Month boundary scenarios", () => {
    it("should handle last day of December correctly", () => {
      const dec31Job = mockJobsAcrossYearBoundary.find(
        (j) => j.date === "2025-12-31",
      );
      expect(dec31Job).toBeDefined();

      const weekEnd = endOfWeek(parseISO(dec31Job!.date), { weekStartsOn: 1 });
      // Dec 31, 2025 is a Wednesday, so week ends on Jan 4, 2026
      expect(format(weekEnd, "yyyy-MM-dd")).toBe("2026-01-04");
    });

    it("should handle first day of January correctly", () => {
      const jan1Job = mockJobsAcrossYearBoundary.find(
        (j) => j.date === "2026-01-01",
      );
      expect(jan1Job).toBeDefined();

      const weekEnd = endOfWeek(parseISO(jan1Job!.date), { weekStartsOn: 1 });
      // Jan 1, 2026 is a Thursday, so week ends on Jan 4, 2026
      expect(format(weekEnd, "yyyy-MM-dd")).toBe("2026-01-04");
    });
  });

  describe("Week ending dropdown behaviour", () => {
    it("December 2025 dropdown should not show any January 2026 dates", () => {
      const weekEndings = getWeekEndingsForMonth({
        jobs: mockJobsAcrossYearBoundary,
        selectedYear: 2025,
        selectedMonth: 11, // December
      });

      for (const weekEnd of weekEndings) {
        expect(getYear(weekEnd)).toBe(2025);
        expect(getMonth(weekEnd)).toBe(11); // December
      }
    });

    it("January 2026 dropdown should not show any December 2025 dates", () => {
      const weekEndings = getWeekEndingsForMonth({
        jobs: mockJobsAcrossYearBoundary,
        selectedYear: 2026,
        selectedMonth: 0, // January
      });

      for (const weekEnd of weekEndings) {
        expect(getYear(weekEnd)).toBe(2026);
        expect(getMonth(weekEnd)).toBe(0); // January
      }
    });
  });
});
