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
 * Opens the RCTI page on a given week (year, month and week ending).
 */
export async function openRctiWeek({
  page,
  week,
}: {
  page: Page;
  week: E2eWeek;
}): Promise<void> {
  await page.goto("/rcti");
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
 * Ticks drivers in the driver filter and closes it.
 */
export async function selectRctiDrivers({
  page,
  driverIds,
}: {
  page: Page;
  driverIds: number[];
}): Promise<void> {
  await page.locator(byId("filter-driver-filter-btn")).click();
  for (const driverId of driverIds) {
    await page.locator(byId(`filter-driver-${driverId}`)).click();
  }
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
 * Checks the selected RCTI's status badge and money totals to the cent.
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
  await expect(row.getByText(status, { exact: true })).toBeVisible({
    timeout: RCTI_ACTION_TIMEOUT,
  });
  await expect(page.locator(byId("rcti-total-inc-gst"))).toHaveText(
    totalIncGst,
    { timeout: RCTI_ACTION_TIMEOUT },
  );
  await expect(page.locator(byId("rcti-amount-payable"))).toHaveText(
    amountPayable,
    { timeout: RCTI_ACTION_TIMEOUT },
  );
}

export { byId };
