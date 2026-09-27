import { test, expect, type Page } from "@playwright/test";
import { format } from "date-fns";
import { STORAGE_STATE } from "../helpers/storage-state";
import {
  buildE2eTag,
  cleanupE2eData,
  disconnectE2eDb,
  getE2eDb,
} from "../helpers/e2e-db";
import {
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
  openRctiWeek,
  RCTI_ACTION_TIMEOUT,
  rctiRow,
  selectRctiDrivers,
} from "../helpers/rcti-page";

test.describe.configure({ mode: "serial", timeout: 120_000 });

const week = getE2eWeek({ weeksAgo: 4 });

let page: Page;
let tag: string;
let driver: E2eDriver;
let weeklyDeductionId: number;
let reimbursementId: number;

async function getDeduction({ id }: { id: number }) {
  const { rows } = await getE2eDb().query(
    `SELECT "amountPaid", "amountRemaining", status FROM "RctiDeduction" WHERE id = $1`,
    [id],
  );
  return {
    amountPaid: Number(rows[0].amountPaid),
    amountRemaining: Number(rows[0].amountRemaining),
    status: rows[0].status as string,
  };
}

async function chooseOption({
  triggerId,
  option,
}: {
  triggerId: string;
  option: string;
}): Promise<void> {
  await page.locator(byId(triggerId)).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test.describe("RCTI deductions and reimbursements", () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    const db = getE2eDb();
    tag = buildE2eTag({ testInfo });
    driver = await createE2eDriver({ db, tag, key: "SUB" });
    // 8 h tray job at $70 on exclusive GST: $616.00 including GST.
    await createE2eJobs({
      db,
      tag,
      driver,
      jobs: [{ date: getE2eJobDate({ week, day: 1 }), chargedHours: 8 }],
    });
    const monday = getE2eJobDate({ week, day: 0 });
    weeklyDeductionId = (
      await createE2eDeduction({
        db,
        driverId: driver.id,
        type: "deduction",
        description: `E2E ${tag} truck repairs`,
        totalAmount: 150,
        amountPerCycle: 50,
        frequency: "weekly",
        startDate: monday,
      })
    ).id;
    reimbursementId = (
      await createE2eDeduction({
        db,
        driverId: driver.id,
        type: "reimbursement",
        description: `E2E ${tag} parking`,
        totalAmount: 30,
        frequency: "once",
        startDate: monday,
      })
    ).id;
    page = await browser.newPage({ storageState: STORAGE_STATE });
  });

  test.afterAll(async () => {
    await page?.close();
    await cleanupE2eData({ db: getE2eDb(), tag });
    await disconnectE2eDb();
  });

  test("shows pending deductions and reimbursements in the amount payable", async () => {
    await openRctiWeek({ page, week });
    await selectRctiDrivers({ page, driverIds: [driver.id] });
    await page.locator(byId("create-rcti-btn")).click();

    // $616.00 - $50.00 weekly deduction + $30.00 reimbursement.
    await expectRctiDetail({
      page,
      row: rctiRow({ page, driverName: driver.driver }),
      status: "Draft",
      totalIncGst: "$616.00",
      amountPayable: "$596.00",
    });
  });

  test("adds a one-off deduction from the RCTI", async () => {
    await page.locator(byId("add-deduction-btn")).click();
    await chooseOption({ triggerId: "deduction-type", option: "Deduction" });
    await chooseOption({ triggerId: "deduction-frequency", option: "One-off" });
    await page.locator(byId("deduction-description")).fill(`E2E ${tag} fuel card`);
    await page.locator(byId("deduction-total")).fill("20");
    await page
      .locator(byId("deduction-start-date"))
      .fill(format(getE2eJobDate({ week, day: 0 }), "yyyy-MM-dd"));
    await page.locator(byId("save-deduction-btn")).click();

    await expect(page.locator(byId("rcti-amount-payable"))).toHaveText("$576.00", {
      timeout: RCTI_ACTION_TIMEOUT,
    });
  });

  test("adjusts one deduction and skips another for this week", async () => {
    const { rows } = await getE2eDb().query(
      `SELECT id FROM "RctiDeduction" WHERE "driverId" = $1 AND description = $2`,
      [driver.id, `E2E ${tag} fuel card`],
    );
    const oneOffId = rows[0].id as number;

    await page.locator(byId(`adjust-pending-deduction-${weeklyDeductionId}`)).click();
    await page.locator(byId(`edit-pending-deduction-${weeklyDeductionId}`)).click();
    await page.locator(byId(`pending-deduction-${weeklyDeductionId}-amount`)).fill("25");

    await page.locator(byId(`adjust-pending-deduction-${oneOffId}`)).click();
    await page.locator(byId(`skip-pending-deduction-${oneOffId}`)).click();

    // $616.00 - $25.00 adjusted deduction + $30.00 reimbursement, fuel card skipped.
    await expect(page.locator(byId("rcti-amount-payable"))).toHaveText("$621.00");
  });

  test("finalising applies the adjusted amounts and leaves skipped ones owing", async () => {
    await page.locator(byId("finalize-rcti-btn")).click();

    await expectRctiDetail({
      page,
      row: rctiRow({ page, driverName: driver.driver }),
      status: "Finalised",
      totalIncGst: "$616.00",
      amountPayable: "$621.00",
    });

    expect(await getDeduction({ id: weeklyDeductionId })).toEqual({
      amountPaid: 25,
      amountRemaining: 125,
      status: "active",
    });
    expect(await getDeduction({ id: reimbursementId })).toEqual({
      amountPaid: 30,
      amountRemaining: 0,
      status: "completed",
    });
    const { rows } = await getE2eDb().query(
      `SELECT "amountPaid", "amountRemaining", status FROM "RctiDeduction" WHERE "driverId" = $1 AND description = $2`,
      [driver.id, `E2E ${tag} fuel card`],
    );
    expect(rows[0]).toEqual({
      amountPaid: "0.00",
      amountRemaining: "20.00",
      status: "active",
    });
  });
});
