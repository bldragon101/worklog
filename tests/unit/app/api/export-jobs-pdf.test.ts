/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { POST as exportJobsPdf } from "@/app/api/export/jobs/pdf/route";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  renderToStream: vi.fn(),
  createElement: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobs: { findMany: mocks.findMany },
    companySettings: { findFirst: mocks.findFirst },
  },
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user" }),
}));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ headers: {} }),
  rateLimitConfigs: { general: {}, export: {} },
}));
vi.mock("@/lib/company-logo", () => ({
  buildCompanyLogoAssets: vi.fn().mockResolvedValue({ logoDataUrl: "" }),
}));
vi.mock("@react-pdf/renderer", () => ({
  renderToStream: mocks.renderToStream,
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Document: "Document",
  Page: "Page",
  Text: "Text",
  View: "View",
  Image: "Image",
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  mocks.createElement.mockImplementation(actual.createElement);
  return {
    ...actual,
    default: { ...actual, createElement: mocks.createElement },
    createElement: mocks.createElement,
  };
});

const dbJob = {
  id: 7,
  date: new Date("2026-10-27T00:00:00.000Z"),
  driver: "JOHN",
  customer: "Acme",
  billTo: "Acme Group",
  registration: "ABC123",
  truckType: "Tray",
  pickup: "Dandenong",
  dropoff: null,
  startTime: new Date("2026-10-27T06:30:00.000Z"),
  finishTime: null,
  chargedHours: 8,
  travelTimeHours: null,
  driverCharge: null,
  deductionHours: null,
  driverOnly: null,
  runsheet: true,
  invoiced: null,
  jobReference: null,
  eastlink: 2,
  citylink: null,
  comments: null,
};

function postExport({ body }: { body: unknown }) {
  return exportJobsPdf(
    new NextRequest("http://localhost/api/export/jobs/pdf", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

async function* pdfChunks() {
  yield Buffer.from("%PDF-test");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany.mockResolvedValue([dbJob]);
  mocks.findFirst.mockResolvedValue({
    companyName: "Test Co",
    companyAbn: null,
    companyAddress: null,
    companyPhone: null,
    companyEmail: null,
    companyLogo: null,
  });
  mocks.renderToStream.mockImplementation(async () => pdfChunks());
});

describe("POST /api/export/jobs/pdf", () => {
  it("returns a PDF of the requested jobs ordered by day, driver and start", async () => {
    const response = await postExport({
      body: { jobIds: [7, 7, 3], periodLabel: "Week ending 2 November 2026" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe(
      "%PDF-test",
    );
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { id: { in: [7, 3] } },
      orderBy: [{ date: "asc" }, { driver: "asc" }, { startTime: "asc" }],
    });
  });

  it("passes jobs to the template as ISO strings with null flags defaulted", async () => {
    await postExport({
      body: {
        jobIds: [7],
        appliedFilters: [{ label: "Driver", values: ["JOHN"] }],
        search: "  acme  ",
        selectedOnly: true,
      },
    });

    const templateProps = mocks.createElement.mock.calls.at(-1)?.[1];
    expect(templateProps.jobs[0]).toMatchObject({
      date: "2026-10-27T00:00:00.000Z",
      startTime: "2026-10-27T06:30:00.000Z",
      finishTime: null,
      driverOnly: false,
      invoiced: false,
      runsheet: true,
    });
    expect(templateProps.appliedFilters).toEqual([
      { label: "Driver", values: ["JOHN"] },
    ]);
    expect(templateProps.search).toBe("acme");
    expect(templateProps.selectedOnly).toBe(true);
    expect(templateProps.periodLabel).toBeNull();
    expect(templateProps.settings.companyName).toBe("Test Co");
  });

  it("still renders when company settings are not configured", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const response = await postExport({ body: { jobIds: [7] } });

    expect(response.status).toBe(200);
  });

  it.each([
    ["no job IDs", { jobIds: [] }],
    ["non-numeric job IDs", { jobIds: ["7"] }],
    ["a missing job ID list", { periodLabel: "October 2026" }],
  ])("rejects %s with a 400", async (_label, body) => {
    const response = await postExport({ body });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Invalid export request",
    });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
