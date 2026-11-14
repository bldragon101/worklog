import { expect, type Page } from "@playwright/test";
import { goldenDrivers } from "../fixtures/golden-data";

export function jobReferenceFor({
  tag,
  workerIndex,
}: {
  tag: string;
  workerIndex: number;
}): string {
  return `E2E-${tag}-W${workerIndex}`;
}

/**
 * Picks an option in a `SearchableSelect` by typing its exact text into the
 * search box, then waits for the trigger to show the chosen value.
 */
export async function selectSearchableOption({
  page,
  id,
  option,
}: {
  page: Page;
  id: string;
  option: string;
}): Promise<void> {
  const trigger = page.locator(`#${id}`);
  await expect(trigger).not.toContainText("Loading...");
  await trigger.click();
  await page.locator(`#${id}-search`).fill(option);
  await page.keyboard.press("Enter");
  await expect(trigger).toContainText(option);
}

/**
 * Picks a golden-data driver in the job form. Parallel specs create and then
 * delete `E2E <tag>` drivers, along with their jobs, so selecting the first
 * option can attach the new job to a driver that is removed mid-test.
 */
export async function selectSeededJobDriver({
  page,
}: {
  page: Page;
}): Promise<void> {
  await selectSearchableOption({
    page,
    id: "driver-select",
    option: goldenDrivers[0].driver,
  });
}
