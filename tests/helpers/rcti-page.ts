import { expect, type Locator, type Page } from "@playwright/test";
import { format } from "date-fns";
import type { E2eWeek } from "./e2e-scenarios";

export const RCTI_ACTION_TIMEOUT = 30_000;

function byId(id: string): string {
  return `[id="${id}"]`;
}

/**
 * Picks an option from one of the page's shadcn select controls.
 */
async function chooseOption({
  page,
  triggerId,
  option,
}: {
  page: Page;
  triggerId: string;
  option: string;
}): Promise<void> {
  await page.locator(byId(triggerId)).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/**
 * Opens a page with week controls (RCTI or jobs report) on a given week.
 */
export async function openWeekPage({
  page,
  path,
  week,
}: {
  page: Page;
  path: "/rcti" | "/jobs-report";
  week: E2eWeek;
}): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await chooseOption({
    page,
    triggerId: "year-select",
    option: format(week.weekEnding, "yyyy"),
  });
  await chooseOption({
    page,
    triggerId: "month-select",
    option: format(week.weekEnding, "MMMM"),
  });
  await chooseOption({
    page,
    triggerId: "week-select",
    option: week.weekEndingLabel,
  });
}

/**
 * Opens the RCTI page on a given week (year, month and week ending).
 */
export async function openRctiWeek({
  page,
  week,
}: {
  page: Page;
  week: E2eWeek;
}): Promise<void> {
  await openWeekPage({ page, path: "/rcti", week });
}

/**
 * Ticks drivers in a page's driver filter and closes it. The RCTI page uses
 * the "filter" id prefix and the jobs report page uses "jr".
 */
export async function selectRctiDrivers({
  page,
  driverIds,
  idPrefix = "filter",
}: {
  page: Page;
  driverIds: number[];
  idPrefix?: "filter" | "jr";
}): Promise<void> {
  await page.locator(byId(`${idPrefix}-driver-filter-btn`)).click();
  await driverIds.reduce(
    (previous, driverId) =>
      previous.then(() =>
        page.locator(byId(`${idPrefix}-driver-${driverId}`)).click(),
      ),
    Promise.resolve(),
  );
  await page.keyboard.press("Escape");
}

/**
 * The RCTI list row for a driver, found by the driver name it shows.
 */
export function rctiRow({
  page,
  driverName,
}: {
  page: Page;
  driverName: string;
}): Locator {
  return page.locator('[id^="rcti-row-"]', { hasText: driverName });
}

/**
 * Reads the RCTI id from a list row's element id.
 */
export async function getRctiIdFromRow({
  row,
}: {
  row: Locator;
}): Promise<number> {
  const id = await row.getAttribute("id");
  return Number(id?.replace("rcti-row-", ""));
}

/**
 * Checks the selected RCTI's status and, for a driver with deductions, the
 * total before deductions and the amount payable, to the cent.
 */
export async function expectRctiDetail({
  page,
  row,
  status,
  totalIncGst,
  amountPayable,
}: {
  page: Page;
  row: Locator;
  status: "Draft" | "Finalised" | "Paid";
  totalIncGst: string;
  amountPayable: string;
}): Promise<void> {
  await expectRctiStatus({ row, status });
  await expect(page.locator(byId("rcti-total-inc-gst"))).toHaveText(
    totalIncGst,
    { timeout: RCTI_ACTION_TIMEOUT },
  );
  await expect(page.locator(byId("rcti-amount-payable"))).toHaveText(
    amountPayable,
    { timeout: RCTI_ACTION_TIMEOUT },
  );
}

/**
 * Checks the selected RCTI's line totals (ex GST, GST, inc GST) to the cent.
 */
export async function expectRctiLineTotals({
  page,
  subtotal,
  gst,
  total,
}: {
  page: Page;
  subtotal: string;
  gst: string;
  total: string;
}): Promise<void> {
  await expect(page.locator(byId("rcti-lines-subtotal"))).toHaveText(subtotal, {
    timeout: RCTI_ACTION_TIMEOUT,
  });
  await expect(page.locator(byId("rcti-lines-gst"))).toHaveText(gst, {
    timeout: RCTI_ACTION_TIMEOUT,
  });
  await expect(page.locator(byId("rcti-lines-total"))).toHaveText(total, {
    timeout: RCTI_ACTION_TIMEOUT,
  });
}

/**
 * Checks the status badge on an RCTI's list row.
 */
export async function expectRctiStatus({
  row,
  status,
}: {
  row: Locator;
  status: "Draft" | "Finalised" | "Paid";
}): Promise<void> {
  await expect(row.getByText(status, { exact: true })).toBeVisible({
    timeout: RCTI_ACTION_TIMEOUT,
  });
}

export { byId };
