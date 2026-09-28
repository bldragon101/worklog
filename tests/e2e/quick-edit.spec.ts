import { test, expect, type Page } from "@playwright/test";
import { format } from "date-fns";
import { STORAGE_STATE } from "../helpers/storage-state";
import {
  buildE2eTag,
  cleanupE2eData,
  disconnectE2eDb,
  E2E_NAME_PREFIX,
  getE2eDb,
} from "../helpers/e2e-db";
import {
  buildE2eRegistration,
  createE2eDriver,
  createE2eJobs,
  type E2eDriver,
} from "../helpers/e2e-scenarios";
import { byId, RCTI_ACTION_TIMEOUT } from "../helpers/rcti-page";

// Every row this spec reads or changes is its own: a tagged driver, truck,
// customer and two jobs this week. The global search limits the quick edit
// table to the tag, so golden data and other specs never affect it.
test.describe.configure({ mode: "serial", timeout: 120_000 });

let page: Page;
let tag: string;
let driver: E2eDriver;
let customer: string;
let jobIds: number[];
let pickupValue: string;

const SAVED = "Changes saved";

function today(): Date {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return date;
}

async function getJob({ id }: { id: number }) {
  const { rows } = await getE2eDb().query(
    `SELECT id, pickup, dropoff FROM "Jobs" WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

async function getCreatedJob() {
  const { rows } = await getE2eDb().query(
    `SELECT id, driver, customer, "billTo", registration, "truckType", pickup
     FROM "Jobs" WHERE pickup = $1`,
    [pickupValue],
  );
  return rows[0] ?? null;
}

async function saveChanges() {
  await page.locator(byId("quick-edit-save-btn")).click();
  await expect(page.getByText(SAVED, { exact: true }).first()).toBeVisible({
    timeout: RCTI_ACTION_TIMEOUT,
  });
  await expect(page.locator(byId("quick-edit-save-btn"))).toHaveCount(0, {
    timeout: RCTI_ACTION_TIMEOUT,
  });
}

async function chooseOption({
  rowKey,
  field,
  option,
}: {
  rowKey: string;
  field: string;
  option: string;
}) {
  await page.locator(byId(`${rowKey}:${field}`)).click();
  await page.getByPlaceholder("Search...").fill(option);
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(page.locator(byId(`${rowKey}:${field}`))).toContainText(option);
}

async function newRowKeys() {
  const ids = await page
    .locator('input[id^="new:"][id$=":date"]')
    .evaluateAll((inputs) => inputs.map((input) => input.id));
  return ids.map((id) => id.replace(/:date$/, ""));
}

test.describe("Quick Edit Mode", () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    const db = getE2eDb();
    tag = buildE2eTag({ testInfo });
    customer = `${E2E_NAME_PREFIX} ${tag} Customer`;
    pickupValue = `${E2E_NAME_PREFIX} ${tag} New pickup`;

    driver = await createE2eDriver({
      db,
      tag,
      key: "QE",
      overrides: { type: "Employee" },
    });
    await db.query(
      `INSERT INTO "Vehicle" (registration, "expiryDate", make, model, "yearOfManufacture", type, "updatedAt")
       VALUES ($1, $2, 'HINO', '500', 2022, 'TRAY', NOW())`,
      [buildE2eRegistration({ tag, key: "QE" }), new Date("2030-01-01")],
    );
    await db.query(
      `INSERT INTO "Customer" (customer, "billTo", contact, tray, "updatedAt")
       VALUES ($1, $1, 'E2E contact', 100, NOW())`,
      [customer],
    );
    const jobs = await createE2eJobs({
      db,
      tag,
      driver,
      jobs: [
        { date: today(), dropoff: "Richmond" },
        { date: today(), dropoff: "Carlton" },
      ],
    });
    jobIds = jobs.map((job) => job.id).sort((a, b) => a - b);

    page = await browser.newPage({ storageState: STORAGE_STATE });
    // Loading a page refreshes the Clerk session cookie used by page.request
    await page.goto("/jobs");

    // Quick edit is limited to a minimum role; make sure the admin test user
    // can use it.
    const settingsResponse = await page.request.get(
      "/api/admin/quick-edit-settings",
    );
    expect(settingsResponse.ok()).toBe(true);
    const settings = await settingsResponse.json();
    if (settings.quickEditMinRole !== "admin") {
      const patchResponse = await page.request.patch(
        "/api/admin/quick-edit-settings",
        { data: { quickEditMinRole: "admin" } },
      );
      expect(patchResponse.ok()).toBe(true);
    }
  });

  test.afterAll(async () => {
    await page?.close();
    await cleanupE2eData({ db: getE2eDb(), tag });
    await disconnectE2eDb();
  });

  test("enters quick edit mode and shows only this spec's jobs", async () => {
    await page.goto("/jobs");
    await page.waitForLoadState("networkidle");
    await page.locator(byId("toggle-quick-edit-btn")).click();

    await expect(page.locator(byId("toggle-quick-edit-standalone-btn"))).toBeVisible();
    await expect(page.getByText("Inline editing mode is active")).toBeVisible();
    await expect(page.locator(byId("quick-edit-add-row-btn"))).toBeVisible();

    await page.locator(byId("global-search-input")).fill(tag);
    for (const id of jobIds) {
      await expect(page.locator(byId(`${id}:date`))).toHaveValue(
        format(today(), "yyyy-MM-dd"),
        { timeout: RCTI_ACTION_TIMEOUT },
      );
    }
    await expect(page.locator('input[id$=":date"]')).toHaveCount(jobIds.length);
  });

  test("adds an empty row and refuses to save it", async () => {
    await page.locator(byId("quick-edit-add-row-btn")).click();

    await expect(page.locator('input[id$=":date"]')).toHaveCount(jobIds.length + 1);
    await expect(page.getByText("1 unsaved change")).toBeVisible();

    await page.locator(byId("quick-edit-save-btn")).click();
    await expect(
      page.getByText("Please fix the highlighted fields before saving", {
        exact: true,
      }),
    ).toBeVisible();
  });

  test("discards pending changes", async () => {
    await page.locator(byId("quick-edit-discard-btn")).click();

    await expect(page.locator(byId("quick-edit-save-btn"))).toHaveCount(0);
    await expect(page.locator('input[id$=":date"]')).toHaveCount(jobIds.length);
  });

  test("adds a job and saves it", async () => {
    await page.locator(byId("quick-edit-add-row-btn")).click();
    const [rowKey] = await newRowKeys();

    await page.locator(byId(`${rowKey}:date`)).fill(format(today(), "yyyy-MM-dd"));
    await chooseOption({ rowKey, field: "driver", option: driver.driver });
    await chooseOption({ rowKey, field: "customer", option: customer });
    await chooseOption({ rowKey, field: "billTo", option: customer });
    await chooseOption({ rowKey, field: "registration", option: driver.truck });
    await chooseOption({ rowKey, field: "truckType", option: "TRAY" });
    await page.locator(byId(`${rowKey}:pickup`)).fill(pickupValue);

    await saveChanges();

    await expect.poll(getCreatedJob, { timeout: RCTI_ACTION_TIMEOUT }).toMatchObject({
      driver: driver.driver,
      customer,
      billTo: customer,
      registration: driver.truck,
      truckType: "TRAY",
      pickup: pickupValue,
    });
  });

  test("edits a job inline and saves it", async () => {
    const dropoff = page.locator(byId(`${jobIds[0]}:dropoff`));
    await dropoff.fill("Fitzroy");
    await expect(page.getByText("1 unsaved change")).toBeVisible();

    await saveChanges();

    await expect
      .poll(() => getJob({ id: jobIds[0] }), { timeout: RCTI_ACTION_TIMEOUT })
      .toMatchObject({ dropoff: "Fitzroy" });
    await expect(dropoff).toHaveValue("Fitzroy", { timeout: RCTI_ACTION_TIMEOUT });
  });

  test("marks a job for deletion and discards it", async () => {
    await page.locator(byId(`quick-edit-delete-${jobIds[1]}`)).click();
    await expect(page.getByText("1 unsaved change")).toBeVisible();

    await page.locator(byId("quick-edit-discard-btn")).click();

    await expect(page.locator(byId("quick-edit-save-btn"))).toHaveCount(0);
    expect(await getJob({ id: jobIds[1] })).not.toBeNull();
  });

  test("counts several unsaved changes", async () => {
    await page.locator(byId("quick-edit-add-row-btn")).click();
    await page.locator(byId("quick-edit-add-row-btn")).click();
    await page.locator(byId(`${jobIds[1]}:dropoff`)).fill("Collingwood");

    await expect(page.getByText("3 unsaved changes")).toBeVisible();

    await page.locator(byId("quick-edit-discard-btn")).click();
    await expect(page.locator(byId("quick-edit-save-btn"))).toHaveCount(0);
  });

  test("warns about unsaved changes before leaving quick edit", async () => {
    await page.locator(byId("quick-edit-add-row-btn")).click();
    await page.locator(byId("toggle-quick-edit-standalone-btn")).click();

    await expect(page.getByRole("heading", { name: "Unsaved Changes" })).toBeVisible();
    await expect(page.getByText("All pending changes will be lost")).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Inline editing mode is active")).toBeVisible();
  });

  test("discards changes and leaves quick edit when confirmed", async () => {
    await page.locator(byId("toggle-quick-edit-standalone-btn")).click();
    await page.getByRole("button", { name: "Discard Changes" }).click();

    await expect(page.locator(byId("toggle-quick-edit-standalone-btn"))).toHaveCount(0);
    await expect(page.locator(byId("add-job-btn"))).toBeVisible();
  });

  test("deletes the added job", async () => {
    await page.locator(byId("toggle-quick-edit-btn")).click();
    await page.locator(byId("global-search-input")).fill(tag);
    const created = await getCreatedJob();
    await expect(page.locator(byId(`${created.id}:pickup`))).toHaveValue(
      pickupValue,
      { timeout: RCTI_ACTION_TIMEOUT },
    );

    await page.locator(byId(`quick-edit-delete-${created.id}`)).click();
    await saveChanges();

    await expect.poll(getCreatedJob, { timeout: RCTI_ACTION_TIMEOUT }).toBeNull();
  });

  test("leaves quick edit without a prompt when nothing is pending", async () => {
    await page.locator(byId("toggle-quick-edit-standalone-btn")).click();

    await expect(page.locator(byId("toggle-quick-edit-standalone-btn"))).toHaveCount(0);
    await expect(page.locator(byId("add-job-btn"))).toBeVisible();
  });
});
