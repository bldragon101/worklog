import { test, expect, type Page } from "@playwright/test";
import { STORAGE_STATE } from "../helpers/storage-state";
import {
  buildE2eTag,
  cleanupE2eData,
  disconnectE2eDb,
  getE2eDb,
} from "../helpers/e2e-db";
import {
  buildE2eRegistration,
  createE2eDeduction,
  createE2eDriver,
  createE2eJobs,
  getE2eJobDate,
  getE2eWeek,
  type E2eDriver,
} from "../helpers/e2e-scenarios";
import {
  byId,
  expectRctiDetail,
  expectRctiLineTotals,
  getRctiIdFromRow,
  openRctiWeek,
  RCTI_ACTION_TIMEOUT,
  rctiRow,
  selectRctiDrivers,
} from "../helpers/rcti-page";

test.describe.configure({ mode: "serial", timeout: 120_000 });

const week = getE2eWeek({ weeksAgo: 2 });

let page: Page;
let tag: string;
let subcontractor: E2eDriver;
let employee: E2eDriver;
let deductionId: number;
let rctiId: number;
let workedExampleJobIds: number[];

async function queryOne<TRow>({
  sql,
  params,
}: {
  sql: string;
  params: unknown[];
}): Promise<TRow> {
  const result = await getE2eDb().query(sql, params);
  return result.rows[0] as TRow;
}

test.describe("RCTI lifecycle", () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    const db = getE2eDb();
    tag = buildE2eTag({ testInfo });

    // Worked example: GST registered on exclusive GST, tray $70, crane $90,
    // 0.5 h lunch break, tolls and a 10% fuel levy.
    subcontractor = await createE2eDriver({
      db,
      tag,
      key: "SUB",
      overrides: { breaks: 0.5, tolls: true, fuelLevy: 10 },
    });
    employee = await createE2eDriver({
      db,
      tag,
      key: "EMP",
      overrides: { type: "Employee" },
    });

    const workedExampleJobs = await createE2eJobs({
      db,
      tag,
      driver: subcontractor,
      jobs: [
        {
          date: getE2eJobDate({ week, day: 1 }),
          chargedHours: 8,
          travelTimeHours: 1,
          eastlink: 2,
        },
        {
          date: getE2eJobDate({ week, day: 2 }),
          chargedHours: 6,
          deductionHours: 0.5,
          citylink: 1,
        },
        {
          date: getE2eJobDate({ week, day: 3 }),
          truckType: "CRANE",
          chargedHours: 8,
          driverCharge: 10,
        },
      ],
    });
    workedExampleJobIds = workedExampleJobs
      .map((job) => job.id)
      .sort((a, b) => a - b);

    // Jobs that must stay off this RCTI: the following week, and the same
    // week on a truck that isn't the subcontractor's.
    await createE2eJobs({
      db,
      tag,
      driver: subcontractor,
      jobs: [
        {
          date: getE2eJobDate({ week: getE2eWeek({ weeksAgo: 1 }), day: 2 }),
          chargedHours: 5,
        },
        {
          date: getE2eJobDate({ week, day: 2 }),
          registration: buildE2eRegistration({ tag, key: "OTHER" }),
          chargedHours: 5,
        },
      ],
    });

    const deduction = await createE2eDeduction({
      db,
      driverId: subcontractor.id,
      type: "deduction",
      description: `E2E ${tag} truck repairs`,
      totalAmount: 150,
      amountPerCycle: 50,
      frequency: "weekly",
      startDate: getE2eJobDate({ week, day: 0 }),
    });
    deductionId = deduction.id;

    page = await browser.newPage({ storageState: STORAGE_STATE });
  });

  test.afterAll(async () => {
    await page?.close();
    await cleanupE2eData({ db: getE2eDb(), tag });
    await disconnectE2eDb();
  });

  test("only offers contractors and subcontractors", async () => {
    await openRctiWeek({ page, week });
    await page.locator(byId("filter-driver-filter-btn")).click();

    await expect(page.locator(byId(`filter-driver-${subcontractor.id}`))).toBeVisible();
    await expect(page.locator(byId(`filter-driver-${employee.id}`))).toHaveCount(0);

    await page.keyboard.press("Escape");
  });

  test("creates an RCTI with every line and total correct to the cent", async () => {
    await selectRctiDrivers({ page, driverIds: [subcontractor.id] });
    await page.locator(byId("create-rcti-btn")).click();

    const row = rctiRow({ page, driverName: subcontractor.driver });
    await expect(row).toContainText("$2303.95", {
      timeout: RCTI_ACTION_TIMEOUT,
    });
    await expect(row).toContainText("8 lines");
    rctiId = await getRctiIdFromRow({ row });

    await expectRctiDetail({
      page,
      row,
      status: "Draft",
      totalIncGst: "$2303.95",
      amountPayable: "$2253.95",
    });
    await expectRctiLineTotals({
      page,
      subtotal: "$2094.50",
      gst: "$209.45",
      total: "$2303.95",
    });

    const { rows: jobLines } = await getE2eDb().query(
      `SELECT "jobId" FROM "RctiLine" WHERE "rctiId" = $1 AND "jobId" IS NOT NULL ORDER BY "jobId"`,
      [rctiId],
    );
    expect(jobLines.map((line) => line.jobId)).toEqual(workedExampleJobIds);
  });

  test("refuses a second RCTI for jobs that are already on one", async () => {
    await page.locator(byId("create-rcti-btn")).click();

    await expect(
      page.getByText("No eligible jobs found for this driver and week").first(),
    ).toBeVisible({
      timeout: RCTI_ACTION_TIMEOUT,
    });
    const { count } = await queryOne<{ count: string }>({
      sql: `SELECT COUNT(*) FROM "Rcti" WHERE "driverId" = $1`,
      params: [subcontractor.id],
    });
    expect(Number(count)).toBe(1);
  });

  test("finalises, locks the lines and applies the weekly deduction", async () => {
    await page.locator(byId("finalize-rcti-btn")).click();

    const row = rctiRow({ page, driverName: subcontractor.driver });
    await expectRctiDetail({
      page,
      row,
      status: "Finalised",
      totalIncGst: "$2303.95",
      amountPayable: "$2253.95",
    });
    await expect(row).toContainText("$2253.95");
    await expect(page.locator(byId("add-manual-line-btn"))).toHaveCount(0);
    await expect(page.locator(byId("finalize-rcti-btn"))).toHaveCount(0);

    const deduction = await queryOne<{ amountRemaining: string; amountPaid: string }>({
      sql: `SELECT "amountRemaining", "amountPaid" FROM "RctiDeduction" WHERE id = $1`,
      params: [deductionId],
    });
    expect(Number(deduction.amountPaid)).toBe(50);
    expect(Number(deduction.amountRemaining)).toBe(100);
  });

  test("marks the RCTI as paid and stops it being unfinalised or deleted", async () => {
    await page.locator(byId("mark-paid-btn")).click();

    const row = rctiRow({ page, driverName: subcontractor.driver });
    await expectRctiDetail({
      page,
      row,
      status: "Paid",
      totalIncGst: "$2303.95",
      amountPayable: "$2253.95",
    });
    await expect(page.locator(byId("unfinalize-rcti-btn"))).toHaveCount(0);
    await expect(page.locator(byId("delete-rcti-btn"))).toHaveCount(0);

    const rcti = await queryOne<{ status: string; paidAt: Date | null }>({
      sql: `SELECT status, "paidAt" FROM "Rcti" WHERE id = $1`,
      params: [rctiId],
    });
    expect(rcti.status).toBe("paid");
    expect(rcti.paidAt).not.toBeNull();
  });

  test("reverts to draft only with a reason, and gives the deduction back", async () => {
    await page.locator(byId("revert-to-draft-btn")).click();
    await page.locator(byId("revert-reason")).fill("oops");
    await expect(page.getByText("Reason must be at least 5 characters")).toBeVisible();
    await expect(page.locator(byId("confirm-revert-btn"))).toBeDisabled();

    const reason = `E2E ${tag} paid to the wrong account`;
    await page.locator(byId("revert-reason")).fill(reason);
    await page.locator(byId("confirm-revert-btn")).click();

    const row = rctiRow({ page, driverName: subcontractor.driver });
    await expectRctiDetail({
      page,
      row,
      status: "Draft",
      totalIncGst: "$2303.95",
      amountPayable: "$2253.95",
    });

    const deduction = await queryOne<{ amountRemaining: string }>({
      sql: `SELECT "amountRemaining" FROM "RctiDeduction" WHERE id = $1`,
      params: [deductionId],
    });
    expect(Number(deduction.amountRemaining)).toBe(150);

    const change = await queryOne<{ fromStatus: string; toStatus: string; reason: string }>({
      sql: `SELECT "fromStatus", "toStatus", reason FROM "RctiStatusChange" WHERE "rctiId" = $1 ORDER BY "changedAt" DESC LIMIT 1`,
      params: [rctiId],
    });
    expect(change).toEqual({ fromStatus: "paid", toStatus: "draft", reason });
  });

  test("refresh picks up a job added after the RCTI was created", async () => {
    // 2 h tray job: +$140.00 job line, +$14.00 fuel levy, +$15.40 GST.
    await createE2eJobs({
      db: getE2eDb(),
      tag,
      driver: subcontractor,
      jobs: [{ date: getE2eJobDate({ week, day: 4 }), chargedHours: 2 }],
    });

    page.once("dialog", (dialog) => dialog.accept());
    const refreshed = page.waitForResponse((response) =>
      response.url().endsWith(`/api/rcti/${rctiId}/refresh`),
    );
    await page.locator(byId("refresh-rcti-btn")).click();
    expect((await refreshed).ok()).toBe(true);

    const row = rctiRow({ page, driverName: subcontractor.driver });
    await expect(row).toContainText("9 lines", {
      timeout: RCTI_ACTION_TIMEOUT,
    });
    await expectRctiDetail({
      page,
      row,
      status: "Draft",
      totalIncGst: "$2473.35",
      amountPayable: "$2423.35",
    });
  });

  test("batch pays a finalised RCTI", async () => {
    await page.locator(byId("finalize-rcti-btn")).click();
    const row = rctiRow({ page, driverName: subcontractor.driver });
    await expect(row.getByText("Finalised", { exact: true })).toBeVisible({
      timeout: RCTI_ACTION_TIMEOUT,
    });

    await page.locator(byId(`select-rcti-${rctiId}`)).click();
    await page.locator(byId("bulk-mark-paid-btn")).click();

    await expect(row.getByText("Paid", { exact: true })).toBeVisible({
      timeout: RCTI_ACTION_TIMEOUT,
    });
    const rcti = await queryOne<{ status: string; total: string }>({
      sql: `SELECT status, total FROM "Rcti" WHERE id = $1`,
      params: [rctiId],
    });
    expect(rcti.status).toBe("paid");
    expect(Number(rcti.total)).toBe(2423.35);
  });
});
