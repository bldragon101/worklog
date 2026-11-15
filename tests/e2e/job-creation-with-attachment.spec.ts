import path from "path";
import { test, expect } from "@playwright/test";
import {
  goldenCustomers,
  goldenDrivers,
  goldenVehicles,
} from "../fixtures/golden-data";
import { disconnectE2eDb, getE2eDb } from "../helpers/e2e-db";
import {
  jobReferenceFor,
  selectSearchableOption,
  selectSeededJobDriver,
} from "../helpers/test-data";

const RUNSHEET_PATH = path.resolve(
  __dirname,
  "../resources/example-runsheet.pdf",
);
const UPLOAD_TIMEOUT = 60_000;

const driver = goldenDrivers[0];
const customer = goldenCustomers[0];
const vehicle = goldenVehicles.find(
  ({ registration }) => registration === driver.truck,
);

async function getJobRunsheetState({ jobId }: { jobId: number }) {
  const { rows } = await getE2eDb().query(
    `SELECT runsheet, cardinality("attachmentRunsheet") AS "runsheetCount"
     FROM "Jobs" WHERE id = $1`,
    [jobId],
  );
  return rows[0] ?? null;
}

test.describe("Job Creation with Attachment", () => {
  test.afterAll(async () => {
    await disconnectE2eDb();
  });

  test("should create a job with runsheet attachment and verify checkbox", async ({
    page,
  }, { workerIndex }) => {
    test.setTimeout(120_000);
    const jobReference = jobReferenceFor({ tag: "ATTACH", workerIndex });

    await page.goto("/jobs");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    const addDialog = page.getByRole("dialog", { name: "Add Job" });
    await expect(addDialog).toBeVisible();

    await selectSeededJobDriver({ page });
    if (vehicle) {
      await expect(page.locator("#registration-select")).toContainText(
        vehicle.registration,
      );
      await expect(page.locator("#trucktype-select")).toContainText(
        vehicle.type,
      );
    }

    await selectSearchableOption({
      page,
      id: "customer-select",
      option: customer.customer,
    });
    await expect(page.locator("#billto-select")).toContainText(customer.billTo);

    await page.locator("#pickup").click();
    await page.getByPlaceholder("Search pickup suburbs").fill("Melbourne");
    await page.getByRole("option", { name: /^Melbourne\b/ }).first().click();
    await expect(page.locator("#pickup")).toContainText("Melbourne");
    await page.keyboard.press("Escape");
    await expect(addDialog).toBeVisible();

    await page.locator("#jobReference").fill(jobReference);

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/jobs",
    );
    await page.locator("#save-job-btn").click();
    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBe(true);
    const { id: jobId } = (await createResponse.json()) as { id: number };
    await expect(addDialog).toBeHidden();

    const jobRow = page.locator("tr").filter({ hasText: jobReference });
    await expect(jobRow).toHaveCount(1);
    await jobRow.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("menuitem", { name: "Edit", exact: true }).click();

    const editDialog = page.getByRole("dialog", { name: "Edit Job" });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.locator("#runsheet")).not.toBeChecked();

    await editDialog.getByRole("tab", { name: "Attachments" }).click();
    await expect(
      editDialog.getByText("No attachments for this job"),
    ).toBeVisible();
    await editDialog.locator("#add-attachments-btn").click();

    const uploadDialog = page.getByRole("dialog", {
      name: `Upload Attachments - Job #${jobId}`,
    });
    await expect(uploadDialog).toBeVisible();

    await page.locator("#hidden-file-input").setInputFiles(RUNSHEET_PATH);
    await expect(uploadDialog.getByText("example-runsheet.pdf")).toBeVisible();

    await uploadDialog.locator('[id^="attachment-type-"]').click();
    await page.getByRole("option", { name: "Runsheet", exact: true }).click();
    await expect(
      uploadDialog.getByText("1/1 files have attachment types selected"),
    ).toBeVisible();

    const uploadButton = uploadDialog.locator("#upload-files-btn");
    await expect(uploadButton).toBeEnabled();
    const uploadResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === `/api/jobs/${jobId}/attachments`,
      { timeout: UPLOAD_TIMEOUT },
    );
    await uploadButton.click();
    const uploadResponse = await uploadResponsePromise;
    expect(
      uploadResponse.ok(),
      `Attachment upload failed: ${await uploadResponse.text()}`,
    ).toBe(true);
    await expect(uploadDialog).toBeHidden();

    await expect(
      editDialog.locator(`#delete-attachment-${jobId}-runsheet-0`),
    ).toBeVisible();

    await editDialog.getByRole("tab", { name: "Job Details" }).click();
    await expect(editDialog.locator("#runsheet")).toBeChecked();

    const updateResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname === `/api/jobs/${jobId}`,
    );
    await editDialog.locator("#save-job-btn").click();
    expect((await updateResponsePromise).ok()).toBe(true);
    await expect(editDialog).toBeHidden();

    expect(await getJobRunsheetState({ jobId })).toEqual({
      runsheet: true,
      runsheetCount: 1,
    });
  });
});
