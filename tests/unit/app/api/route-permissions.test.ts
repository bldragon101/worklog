/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import type { PagePermission } from "@/lib/permissions";
import * as jobsReportIdRoute from "@/app/api/jobs-report/[id]/route";
import * as jobsReportFinaliseRoute from "@/app/api/jobs-report/[id]/finalize/route";
import * as jobsReportUnfinaliseRoute from "@/app/api/jobs-report/[id]/unfinalise/route";
import * as jobsReportPdfRoute from "@/app/api/jobs-report/[id]/pdf/route";
import * as companySettingsRoute from "@/app/api/company-settings/route";
import * as uploadImageRoute from "@/app/api/upload-image/route";
import * as serviceAccountRoute from "@/app/api/google-drive/service-account/route";
import * as driveUploadImageRoute from "@/app/api/google-drive/upload-image/route";
import * as jobsBulkRoute from "@/app/api/jobs/bulk/route";
import * as jobAttachmentsRoute from "@/app/api/jobs/[id]/attachments/route";
import * as jobAttachmentsSyncRoute from "@/app/api/jobs/[id]/attachments/sync/route";
import * as bulkAttachmentsRoute from "@/app/api/jobs/attachments/bulk/route";
import * as importCustomersRoute from "@/app/api/import/customers/route";
import * as importDriversRoute from "@/app/api/import/drivers/route";
import * as importVehiclesRoute from "@/app/api/import/vehicles/route";
import * as importJobsRoute from "@/app/api/import/jobs/route";

const mocks = vi.hoisted(() => ({
  checkPermission: vi.fn(),
  prismaAccess: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "user_viewer" }),
  clerkClient: vi.fn(),
}));
// Only the active-user lookup is expected; any other database access means a
// handler did work before checking permissions
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get: (_target, property) => {
        if (property === "user") {
          return { findUnique: async () => ({ isActive: true }) };
        }
        mocks.prismaAccess(property);
        throw new Error(`Unexpected database access: ${String(property)}`);
      },
    },
  ),
}));
vi.mock("@/lib/permissions", () => ({
  checkPermission: mocks.checkPermission,
  getUserRole: async () => "viewer",
}));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ headers: {} }),
  rateLimitConfigs: { general: {}, upload: {}, export: {} },
}));

type Handler = (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

const handlers: Array<{
  name: string;
  method: string;
  handler: Handler;
  permission: PagePermission;
}> = [
  {
    name: "GET /api/jobs-report/[id]",
    method: "GET",
    handler: jobsReportIdRoute.GET,
    permission: "manage_jobs_report",
  },
  {
    name: "PATCH /api/jobs-report/[id]",
    method: "PATCH",
    handler: jobsReportIdRoute.PATCH,
    permission: "manage_jobs_report",
  },
  {
    name: "DELETE /api/jobs-report/[id]",
    method: "DELETE",
    handler: jobsReportIdRoute.DELETE,
    permission: "manage_jobs_report",
  },
  {
    name: "POST /api/jobs-report/[id]/finalize",
    method: "POST",
    handler: jobsReportFinaliseRoute.POST,
    permission: "manage_jobs_report",
  },
  {
    name: "POST /api/jobs-report/[id]/unfinalise",
    method: "POST",
    handler: jobsReportUnfinaliseRoute.POST,
    permission: "manage_jobs_report",
  },
  {
    name: "GET /api/jobs-report/[id]/pdf",
    method: "GET",
    handler: jobsReportPdfRoute.GET,
    permission: "manage_jobs_report",
  },
  {
    name: "POST /api/company-settings",
    method: "POST",
    handler: companySettingsRoute.POST,
    permission: "manage_company_settings",
  },
  {
    name: "POST /api/upload-image",
    method: "POST",
    handler: uploadImageRoute.POST,
    permission: "manage_company_settings",
  },
  {
    name: "GET /api/google-drive/service-account",
    method: "GET",
    handler: serviceAccountRoute.GET,
    permission: "manage_integrations",
  },
  {
    name: "POST /api/google-drive/service-account",
    method: "POST",
    handler: serviceAccountRoute.POST,
    permission: "manage_integrations",
  },
  {
    name: "POST /api/google-drive/upload-image",
    method: "POST",
    handler: driveUploadImageRoute.POST,
    permission: "manage_integrations",
  },
  {
    name: "DELETE /api/jobs/bulk",
    method: "DELETE",
    handler: jobsBulkRoute.DELETE,
    permission: "delete_jobs",
  },
  {
    name: "PATCH /api/jobs/bulk",
    method: "PATCH",
    handler: jobsBulkRoute.PATCH,
    permission: "edit_jobs",
  },
  {
    name: "POST /api/jobs/[id]/attachments",
    method: "POST",
    handler: jobAttachmentsRoute.POST,
    permission: "edit_jobs",
  },
  {
    name: "DELETE /api/jobs/[id]/attachments",
    method: "DELETE",
    handler: jobAttachmentsRoute.DELETE,
    permission: "edit_jobs",
  },
  {
    name: "POST /api/jobs/[id]/attachments/sync",
    method: "POST",
    handler: jobAttachmentsSyncRoute.POST,
    permission: "edit_jobs",
  },
  {
    name: "POST /api/jobs/attachments/bulk",
    method: "POST",
    handler: bulkAttachmentsRoute.POST,
    permission: "edit_jobs",
  },
  {
    name: "POST /api/import/customers",
    method: "POST",
    handler: importCustomersRoute.POST,
    permission: "create_customers",
  },
  {
    name: "POST /api/import/drivers",
    method: "POST",
    handler: importDriversRoute.POST,
    permission: "create_drivers",
  },
  {
    name: "POST /api/import/vehicles",
    method: "POST",
    handler: importVehiclesRoute.POST,
    permission: "create_vehicles",
  },
  {
    name: "POST /api/import/jobs",
    method: "POST",
    handler: importJobsRoute.POST,
    permission: "create_jobs",
  },
];

function buildRequest({ method }: { method: string }) {
  return new NextRequest("http://localhost/api/resource/5?action=list", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify({}),
  });
}

const context = { params: Promise.resolve({ id: "5" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkPermission.mockResolvedValue(false);
});

describe("API routes that require a role permission", () => {
  it.each(handlers)(
    "$name rejects a signed-in user without $permission",
    async ({ method, handler, permission }) => {
      const response = await handler(buildRequest({ method }), context);

      expect(response.status).toBe(403);
      expect(mocks.checkPermission).toHaveBeenCalledWith(permission);
      expect(mocks.prismaAccess).not.toHaveBeenCalled();
    },
  );
});

describe("POST /api/jobs/bulk batch permissions", () => {
  const createItem = {
    date: "2026-09-01",
    driver: "ALEX",
    customer: "Acme",
    billTo: "Acme",
    truckType: "Tray",
    registration: "ABC123",
    pickup: "Melbourne",
  };

  function batchRequest({ body }: { body: unknown }) {
    return new NextRequest("http://localhost/api/jobs/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function grant({ permissions }: { permissions: PagePermission[] }) {
    mocks.checkPermission.mockImplementation(async (permission) =>
      permissions.includes(permission),
    );
  }

  it.each([
    {
      name: "creates without create_jobs",
      body: { creates: [createItem] },
      granted: ["edit_jobs", "delete_jobs"],
      missing: "create_jobs",
    },
    {
      name: "updates without edit_jobs",
      body: { updates: [{ id: 5, data: { pickup: "Geelong" } }] },
      granted: ["create_jobs", "delete_jobs"],
      missing: "edit_jobs",
    },
    {
      name: "deletes without delete_jobs",
      body: {
        creates: [createItem],
        updates: [{ id: 5, data: { pickup: "Geelong" } }],
        deletes: [6],
      },
      granted: ["create_jobs", "edit_jobs"],
      missing: "delete_jobs",
    },
  ] as const)(
    "rejects a batch with $name",
    async ({ body, granted, missing }) => {
      grant({ permissions: [...granted] });

      const response = await jobsBulkRoute.POST(batchRequest({ body }));

      expect(response.status).toBe(403);
      expect(mocks.checkPermission).toHaveBeenCalledWith(missing);
      expect(mocks.prismaAccess).not.toHaveBeenCalled();
    },
  );

  it("only checks the permissions for the operations in the batch", async () => {
    grant({ permissions: ["edit_jobs"] });

    await jobsBulkRoute
      .POST(
        batchRequest({ body: { updates: [{ id: 5, data: { pickup: "X" } }] } }),
      )
      .catch(() => null);

    expect(mocks.checkPermission).toHaveBeenCalledWith("edit_jobs");
    expect(mocks.checkPermission).not.toHaveBeenCalledWith("create_jobs");
    expect(mocks.checkPermission).not.toHaveBeenCalledWith("delete_jobs");
  });
});
