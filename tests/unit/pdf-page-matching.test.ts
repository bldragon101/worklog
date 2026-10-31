// @vitest-environment node
import { PDFDocument } from "pdf-lib";
import {
  extractDatesFromText,
  findBestJobForPage,
  formatPageRanges,
  getJobDateParts,
  groupPageAssignments,
  suggestPageAssignments,
  type PageAssignment,
} from "@/lib/utils/pdf-page-matching";
import { buildPageSuffix, splitPdfIntoGroups } from "@/lib/utils/pdf-split";
import type { Job } from "@/lib/types";

function makeJob({
  id,
  date,
  driver,
  customer,
}: {
  id: number;
  date: string;
  driver: string;
  customer: string;
}): Job {
  return {
    id,
    date,
    driver,
    customer,
    billTo: customer,
    registration: "ABC123",
    truckType: "Tray",
    pickup: "Melbourne",
    dropoff: "Geelong",
    runsheet: false,
    invoiced: false,
    chargedHours: 8,
    driverCharge: null,
    startTime: null,
    finishTime: null,
    comments: null,
    jobReference: null,
    eastlink: null,
    citylink: null,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  } as Job;
}

const weekJobs: Job[] = [
  makeJob({ id: 13, date: "2026-10-28", driver: "JOHN DOE", customer: "ACME" }),
  makeJob({ id: 11, date: "2026-10-26", driver: "JOHN DOE", customer: "ACME" }),
  makeJob({ id: 12, date: "2026-10-27", driver: "JOHN DOE", customer: "ACME" }),
];

describe("getJobDateParts", () => {
  it("reads the date parts of an ISO timestamp without timezone conversion", () => {
    expect(getJobDateParts({ date: "2026-10-27T00:00:00.000Z" })).toEqual({
      year: 2026,
      month: 10,
      day: 27,
    });
    expect(getJobDateParts({ date: "2026-10-26T13:00:00.000Z" })).toEqual({
      year: 2026,
      month: 10,
      day: 26,
    });
  });

  it("uses a bare date as-is", () => {
    expect(getJobDateParts({ date: "2026-10-27" })).toEqual({
      year: 2026,
      month: 10,
      day: 27,
    });
  });

  it("returns null for an unrecognised date", () => {
    expect(getJobDateParts({ date: "27/10/2026" })).toBeNull();
  });

  it("matches a page to a job stored as a midnight UTC timestamp", () => {
    const jobs = [
      makeJob({ id: 1, date: "2026-10-26T00:00:00.000Z", driver: "A B", customer: "C" }),
      makeJob({ id: 2, date: "2026-10-27T00:00:00.000Z", driver: "A B", customer: "C" }),
    ];
    expect(findBestJobForPage({ text: "Tuesday 27/10/2026", jobs })).toBe(2);
  });

  it("matches weekday names across months and leap years", () => {
    const cases: Array<{ date: string; weekday: string }> = [
      { date: "2026-10-26", weekday: "Monday" },
      { date: "2026-01-01", weekday: "Thursday" },
      { date: "2026-02-28", weekday: "Saturday" },
      { date: "2028-02-29", weekday: "Tuesday" },
      { date: "2026-12-31", weekday: "Thursday" },
    ];
    for (const { date, weekday } of cases) {
      const jobs = [makeJob({ id: 1, date, driver: "A B", customer: "C" })];
      expect(findBestJobForPage({ text: weekday, jobs })).toBe(1);
    }
  });
});

describe("extractDatesFromText", () => {
  it("reads Australian day-first and ISO dates", () => {
    const dates = extractDatesFromText({
      text: "Run date 27/10/2026, docket 28.10.26 ref 2026-10-29 and 1-11-2026",
    });
    expect(dates).toEqual(
      expect.arrayContaining([
        "2026-10-27",
        "2026-10-28",
        "2026-10-29",
        "2026-11-01",
      ]),
    );
  });

  it("ignores impossible dates", () => {
    expect(extractDatesFromText({ text: "45/13/2026" })).toEqual([]);
  });
});

describe("findBestJobForPage", () => {
  it("picks the job whose date is on the page", () => {
    expect(
      findBestJobForPage({ text: "Runsheet John Doe 27/10/2026", jobs: weekJobs }),
    ).toBe(12);
  });

  it("matches on weekday name when no date is written", () => {
    expect(
      findBestJobForPage({ text: "WEDNESDAY runsheet", jobs: weekJobs }),
    ).toBe(13);
  });

  it("returns null when jobs tie", () => {
    expect(findBestJobForPage({ text: "John Doe", jobs: weekJobs })).toBeNull();
  });

  it("separates drivers on the same day", () => {
    const jobs = [
      makeJob({ id: 1, date: "2026-10-26", driver: "JOHN DOE", customer: "A" }),
      makeJob({ id: 2, date: "2026-10-26", driver: "JANE SMITH", customer: "A" }),
    ];
    expect(
      findBestJobForPage({ text: "26/10/2026 Driver: Jane Smith", jobs }),
    ).toBe(2);
  });
});

describe("suggestPageAssignments", () => {
  it("assigns matched pages as runsheets and trailing pages as dockets", () => {
    const assignments = suggestPageAssignments({
      pageTexts: [
        "Runsheet 26/10/2026",
        "Docket #4411 weighbridge",
        "Docket #4412 weighbridge",
        "Runsheet 27/10/2026",
        "Runsheet 28/10/2026",
      ],
      jobs: weekJobs,
    });

    expect(
      assignments.map(({ jobId, attachmentType, reason }) => ({
        jobId,
        attachmentType,
        reason,
      })),
    ).toEqual([
      { jobId: 11, attachmentType: "runsheet", reason: "matched" },
      { jobId: 11, attachmentType: "docket", reason: "continuation" },
      { jobId: 11, attachmentType: "docket", reason: "continuation" },
      { jobId: 12, attachmentType: "runsheet", reason: "matched" },
      { jobId: 13, attachmentType: "runsheet", reason: "matched" },
    ]);
  });

  it("leaves leading unmatched pages unassigned", () => {
    const assignments = suggestPageAssignments({
      pageTexts: ["Cover sheet", "Runsheet 26/10/2026"],
      jobs: weekJobs,
    });
    expect(assignments[0].jobId).toBeNull();
    expect(assignments[1].jobId).toBe(11);
  });

  it("maps scanned pages in date order when there is one page per job", () => {
    const assignments = suggestPageAssignments({
      pageTexts: ["", "", ""],
      jobs: weekJobs,
    });
    expect(assignments.map((a) => a.jobId)).toEqual([11, 12, 13]);
    expect(assignments.every((a) => a.reason === "sequential")).toBe(true);
  });

  it("does not guess for scanned pages when counts differ", () => {
    const assignments = suggestPageAssignments({
      pageTexts: ["", "", "", ""],
      jobs: weekJobs,
    });
    expect(assignments.every((a) => a.jobId === null)).toBe(true);
  });
});

describe("groupPageAssignments", () => {
  it("groups pages by job and type in page order, skipping unassigned", () => {
    const assignments: PageAssignment[] = [
      { pageIndex: 0, jobId: 1, attachmentType: "runsheet", reason: null },
      { pageIndex: 1, jobId: 1, attachmentType: "docket", reason: null },
      { pageIndex: 2, jobId: null, attachmentType: "runsheet", reason: null },
      { pageIndex: 3, jobId: 2, attachmentType: "runsheet", reason: null },
      { pageIndex: 4, jobId: 1, attachmentType: "docket", reason: null },
    ];
    expect(groupPageAssignments({ assignments })).toEqual([
      { jobId: 1, attachmentType: "runsheet", pageIndexes: [0] },
      { jobId: 1, attachmentType: "docket", pageIndexes: [1, 4] },
      { jobId: 2, attachmentType: "runsheet", pageIndexes: [3] },
    ]);
  });
});

describe("formatPageRanges", () => {
  it("collapses consecutive pages", () => {
    expect(formatPageRanges({ pageIndexes: [5, 0, 1, 2] })).toBe("p1-3_p6");
    expect(formatPageRanges({ pageIndexes: [3] })).toBe("p4");
  });
});

describe("buildPageSuffix", () => {
  it("keeps short range lists", () => {
    expect(buildPageSuffix({ pageIndexes: [0, 1, 2, 5] })).toBe("p1-3_p6");
  });

  it("compacts scattered pages so filenames stay short", () => {
    const alternatingPages = Array.from({ length: 60 }, (_, i) => i * 2);
    const suffix = buildPageSuffix({ pageIndexes: alternatingPages });
    expect(suffix).toBe("p1-119_60pages");
  });
});

describe("splitPdfIntoGroups", () => {
  async function makeSourcePdf({ pageCount }: { pageCount: number }) {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pageCount; i++) {
      doc.addPage([200 + i, 300]);
    }
    const bytes = await doc.save();
    return bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
  }

  it("writes one PDF per group containing only its pages", async () => {
    const sourceBytes = await makeSourcePdf({ pageCount: 5 });
    const files = await splitPdfIntoGroups({
      sourceBytes,
      sourceName: "Week 44 runsheets.pdf",
      groups: [
        { jobId: 1, attachmentType: "runsheet", pageIndexes: [0] },
        { jobId: 1, attachmentType: "docket", pageIndexes: [1, 2] },
        { jobId: 2, attachmentType: "runsheet", pageIndexes: [4] },
      ],
    });

    expect(files.map((f) => f.file.name)).toEqual([
      "Week_44_runsheets_p1.pdf",
      "Week_44_runsheets_p2-3.pdf",
      "Week_44_runsheets_p5.pdf",
    ]);

    const docket = await PDFDocument.load(await files[1].file.arrayBuffer());
    expect(docket.getPageCount()).toBe(2);
    expect(docket.getPage(0).getWidth()).toBe(201);
    expect(docket.getPage(1).getWidth()).toBe(202);
    expect(files[1].file.type).toBe("application/pdf");
  });

  it("keeps filenames within the server limit for long sources and scattered pages", async () => {
    const sourceBytes = await makeSourcePdf({ pageCount: 120 });
    const files = await splitPdfIntoGroups({
      sourceBytes,
      sourceName: `${"Very long weekly runsheet export ".repeat(10)}.pdf`,
      groups: [
        {
          jobId: 1,
          attachmentType: "runsheet",
          pageIndexes: Array.from({ length: 60 }, (_, i) => i * 2),
        },
      ],
    });
    expect(files[0].file.name.length).toBeLessThanOrEqual(110);
    expect(files[0].file.name.endsWith("_p1-119_60pages.pdf")).toBe(true);
  });

  it("rejects page indexes outside the document", async () => {
    const sourceBytes = await makeSourcePdf({ pageCount: 2 });
    await expect(
      splitPdfIntoGroups({
        sourceBytes,
        sourceName: "a.pdf",
        groups: [{ jobId: 1, attachmentType: "runsheet", pageIndexes: [2] }],
      }),
    ).rejects.toThrow("Page 3 does not exist");
  });
});
