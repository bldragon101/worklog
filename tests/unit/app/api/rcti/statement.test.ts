/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import * as ReactPDF from "@react-pdf/renderer";
import { POST as postPdf } from "@/app/api/rcti/statement/pdf/route";
import { POST as postEmail } from "@/app/api/rcti/statement/email/route";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/resend";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rcti: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    companySettings: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/permissions", () => ({
  checkPermission: async () => true,
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user-123" }),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({
    headers: { "X-RateLimit-Limit": "100" },
  }),
  rateLimitConfigs: { general: {} },
}));

vi.mock("@react-pdf/renderer", () => ({
  renderToStream: vi.fn(),
  StyleSheet: {
    create: vi.fn((styles: Record<string, unknown>) => styles),
  },
  Document: "Document",
  Page: "Page",
  Text: "Text",
  View: "View",
  Image: "Image",
}));

vi.mock("@/lib/resend", () => ({
  sendEmail: vi.fn(),
}));

const mockFindMany = prisma.rcti.findMany as vi.Mock;
const mockUpdateMany = prisma.rcti.updateMany as vi.Mock;
const mockFindSettings = prisma.companySettings.findFirst as vi.Mock;
const mockRenderToStream = ReactPDF.renderToStream as vi.Mock;
const mockSendEmail = sendEmail as vi.MockedFunction<typeof sendEmail>;

function makeRcti({
  id,
  status,
  weekEnding,
}: {
  id: number;
  status: string;
  weekEnding: string;
}) {
  return {
    id,
    invoiceNumber: `RCTI-${id}`,
    driverId: 10,
    driverName: "John Smith",
    businessName: "Smith Transport",
    driverAddress: "123 Test St",
    driverAbn: "12 345 678 901",
    weekEnding: new Date(weekEnding),
    gstStatus: "registered",
    gstMode: "exclusive",
    bankAccountName: null,
    bankBsb: null,
    bankAccountNumber: null,
    subtotal: 1000,
    gst: 100,
    total: 1100,
    status,
    notes: null,
    paidAt: status === "paid" ? new Date("2026-01-20T01:00:00.000Z") : null,
    revertedToDraftAt: null,
    revertedToDraftReason: null,
    lines: [],
    deductionApplications: [],
    driver: { id: 10, email: "driver@example.com" },
  };
}

const settings = {
  companyName: "Test Company",
  companyAbn: null,
  companyAddress: null,
  companyPhone: null,
  companyEmail: "info@test.com",
  companyLogo: null,
  emailReplyTo: null,
};

function createRequest({ path, body }: { path: string; body: unknown }) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const context = { params: Promise.resolve({}) };

describe("RCTI statement API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindSettings.mockResolvedValue(settings);
    mockRenderToStream.mockImplementation(async () => ({
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from("PDF");
      },
    }));
    mockSendEmail.mockResolvedValue({ success: true, messageId: "msg-1" });
    mockUpdateMany.mockResolvedValue({ count: 2 });
  });

  describe("POST /api/rcti/statement/pdf", () => {
    it("returns the statement PDF for the driver's RCTIs", async () => {
      mockFindMany.mockResolvedValue([
        makeRcti({ id: 1, status: "paid", weekEnding: "2026-01-04" }),
        makeRcti({ id: 2, status: "finalised", weekEnding: "2026-01-11" }),
      ]);

      const response = await postPdf(
        createRequest({
          path: "/api/rcti/statement/pdf",
          body: { driverId: 10, rctiIds: [1, 2] },
        }),
        context,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
      expect(response.headers.get("Content-Disposition")).toBe(
        'inline; filename="Statement-John-Smith-2026-01-04-to-2026-01-11.pdf"',
      );
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: [1, 2] }, driverId: 10 },
        }),
      );
    });

    it("rejects RCTIs that do not belong to the driver", async () => {
      mockFindMany.mockResolvedValue([
        makeRcti({ id: 1, status: "paid", weekEnding: "2026-01-04" }),
      ]);

      const response = await postPdf(
        createRequest({
          path: "/api/rcti/statement/pdf",
          body: { driverId: 10, rctiIds: [1, 99] },
        }),
        context,
      );

      expect(response.status).toBe(404);
      expect(mockRenderToStream).not.toHaveBeenCalled();
    });

    it("rejects draft RCTIs", async () => {
      mockFindMany.mockResolvedValue([
        makeRcti({ id: 1, status: "draft", weekEnding: "2026-01-04" }),
      ]);

      const response = await postPdf(
        createRequest({
          path: "/api/rcti/statement/pdf",
          body: { driverId: 10, rctiIds: [1] },
        }),
        context,
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("RCTI-1");
    });

    it("returns 400 for an invalid body", async () => {
      const response = await postPdf(
        createRequest({
          path: "/api/rcti/statement/pdf",
          body: { driverId: 10, rctiIds: [] },
        }),
        context,
      );

      expect(response.status).toBe(400);
      expect(mockFindMany).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/rcti/statement/email", () => {
    beforeEach(() => {
      mockFindMany.mockResolvedValue([
        makeRcti({ id: 1, status: "paid", weekEnding: "2026-01-04" }),
        makeRcti({ id: 2, status: "finalised", weekEnding: "2026-01-11" }),
      ]);
    });

    it("emails only the statement without marking RCTIs as sent", async () => {
      const response = await postEmail(
        createRequest({
          path: "/api/rcti/statement/email",
          body: { driverId: 10, rctiIds: [1, 2] },
        }),
        context,
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        sentTo: "driver@example.com",
        sentAt: null,
        sentRctiIds: [],
      });
      const call = mockSendEmail.mock.calls[0][0];
      expect(call.subject).toBe(
        "RCTI Statement W/E 04/01/2026 - 11/01/2026 from Test Company",
      );
      expect(call.attachments?.map(({ filename }) => filename)).toEqual([
        "Statement-John-Smith-2026-01-04-to-2026-01-11.pdf",
      ]);
      expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it("re-sends each RCTI with the statement and marks them as sent", async () => {
      const response = await postEmail(
        createRequest({
          path: "/api/rcti/statement/email",
          body: { driverId: 10, rctiIds: [1, 2], includeRctis: true },
        }),
        context,
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sentRctiIds).toEqual([1, 2]);
      expect(typeof data.sentAt).toBe("string");
      const call = mockSendEmail.mock.calls[0][0];
      expect(call.attachments?.map(({ filename }) => filename)).toEqual([
        "Statement-John-Smith-2026-01-04-to-2026-01-11.pdf",
        "RCTI-1.pdf",
        "RCTI-2.pdf",
      ]);
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
        data: { sentAt: expect.any(Date) },
      });
    });

    it("re-sends only the RCTIs when the statement is left out", async () => {
      const response = await postEmail(
        createRequest({
          path: "/api/rcti/statement/email",
          body: {
            driverId: 10,
            rctiIds: [1, 2],
            includeStatement: false,
            includeRctis: true,
          },
        }),
        context,
      );

      expect(response.status).toBe(200);
      const call = mockSendEmail.mock.calls[0][0];
      expect(call.subject).toBe(
        "RCTIs W/E 04/01/2026 - 11/01/2026 from Test Company",
      );
      expect(call.attachments?.map(({ filename }) => filename)).toEqual([
        "RCTI-1.pdf",
        "RCTI-2.pdf",
      ]);
    });

    it("returns 400 when the driver has no email address", async () => {
      mockFindMany.mockResolvedValue([
        {
          ...makeRcti({ id: 1, status: "paid", weekEnding: "2026-01-04" }),
          driver: { id: 10, email: null },
        },
      ]);

      const response = await postEmail(
        createRequest({
          path: "/api/rcti/statement/email",
          body: { driverId: 10, rctiIds: [1] },
        }),
        context,
      );

      expect(response.status).toBe(400);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("returns 500 and leaves RCTIs unsent when the email fails", async () => {
      mockSendEmail.mockResolvedValue({ success: false, error: "boom" });

      const response = await postEmail(
        createRequest({
          path: "/api/rcti/statement/email",
          body: { driverId: 10, rctiIds: [1, 2], includeRctis: true },
        }),
        context,
      );

      expect(response.status).toBe(500);
      expect(mockUpdateMany).not.toHaveBeenCalled();
    });
  });
});
