/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/rcti/[id]/email/route";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import * as ReactPDF from "@react-pdf/renderer";
import { sendEmail } from "@/lib/mailgun";
import {
  buildRctiEmailHtml,
  buildRctiEmailSubjectLine,
} from "@/lib/email-templates";

// Mock dependencies
jest.mock("@/lib/prisma", () => ({
  prisma: {
    rcti: {
      findUnique: jest.fn(),
    },
    companySettings: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue({ userId: "test-user-123" }),
}));

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({
    headers: {
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "99",
    },
  }),
  rateLimitConfigs: {
    general: {},
  },
}));

jest.mock("fs/promises", () => ({
  readFile: jest.fn(),
}));

jest.mock("@react-pdf/renderer", () => ({
  renderToStream: jest.fn(),
  StyleSheet: {
    create: jest.fn((styles: Record<string, unknown>) => styles),
  },
  Document: "Document",
  Page: "Page",
  Text: "Text",
  View: "View",
  Image: "Image",
}));

jest.mock("@/lib/rcti-deductions", () => ({
  getPendingDeductionsForDriver: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/mailgun", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("@/lib/email-templates", () => ({
  buildRctiEmailHtml: jest.fn(),
  buildRctiEmailSubjectLine: jest.fn(),
}));

const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockBuildRctiEmailHtml = buildRctiEmailHtml as jest.MockedFunction<
  typeof buildRctiEmailHtml
>;
const mockBuildRctiEmailSubjectLine =
  buildRctiEmailSubjectLine as jest.MockedFunction<
    typeof buildRctiEmailSubjectLine
  >;

describe("RCTI Email API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildRctiEmailSubjectLine.mockReturnValue(
      "RCTI for week ending 20 Jan 2025 - Test Company Pty Ltd",
    );
    mockBuildRctiEmailHtml.mockReturnValue(
      "<html><body>Test email</body></html>",
    );
    mockSendEmail.mockResolvedValue({
      success: true,
      messageId: "msg-123",
    });
  });

  const createMockRequest = ({ host }: { host?: string } = {}) => {
    const request = new NextRequest("http://localhost:3000/api/rcti/1/email", {
      method: "POST",
    });

    if (host) {
      Object.defineProperty(request, "headers", {
        value: new Headers({ host }),
        configurable: true,
      });
    }

    return request;
  };

  const mockRcti = {
    id: 1,
    invoiceNumber: "RCTI-20012025",
    driverId: 10,
    driverName: "John Smith",
    businessName: "Smith Transport",
    driverAddress: "123 Test St, Melbourne VIC 3000",
    driverAbn: "12 345 678 901",
    weekEnding: new Date("2025-01-20T00:00:00.000Z"),
    gstStatus: "registered",
    gstMode: "exclusive",
    bankAccountName: "John Smith",
    bankBsb: "123-456",
    bankAccountNumber: "12345678",
    subtotal: 1000.0,
    gst: 100.0,
    total: 1100.0,
    status: "finalised",
    notes: "Test notes",
    revertedToDraftAt: null,
    revertedToDraftReason: null,
    lines: [
      {
        id: 1,
        jobDate: new Date("2025-01-15T00:00:00.000Z"),
        customer: "Test Customer",
        truckType: "Tray",
        description: "Test job",
        chargedHours: 10.0,
        ratePerHour: 100.0,
        amountExGst: 1000.0,
        gstAmount: 100.0,
        amountIncGst: 1100.0,
      },
    ],
    deductionApplications: [],
    driver: {
      id: 10,
      driver: "John Smith",
      email: "driver@example.com",
      type: "Contractor",
    },
  };

  const mockSettings = {
    id: 1,
    companyName: "Test Company Pty Ltd",
    companyAbn: "98 765 432 109",
    companyAddress: "456 Business Rd, Melbourne VIC 3001",
    companyPhone: "(03) 9876 5432",
    companyEmail: "info@testcompany.com.au",
    companyLogo: null,
    emailReplyTo: "accounts@testcompany.com.au",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createPdfStream = () => ({
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from("PDF content");
    },
  });

  describe("POST /api/rcti/[id]/email", () => {
    it("should return 400 for invalid RCTI ID", async () => {
      const request = createMockRequest();
      const params = Promise.resolve({ id: "invalid" });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid RCTI ID");
      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });

    it("should return 404 when RCTI not found", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest();
      const params = Promise.resolve({ id: "1" });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("RCTI not found");
      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });

    it("should return 400 when RCTI status is draft", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue({
        ...mockRcti,
        status: "draft",
      });

      const request = createMockRequest();
      const params = Promise.resolve({ id: "1" });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Only finalised or paid RCTIs can be emailed");
      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should return 400 when driver email is missing", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue({
        ...mockRcti,
        driver: { ...mockRcti.driver, email: null },
      });

      const request = createMockRequest();
      const params = Promise.resolve({ id: "1" });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(
        "Driver does not have an email address configured. Please add an email to the driver record first.",
      );
      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should return 400 when company settings are not configured", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest();
      const params = Promise.resolve({ id: "1" });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(
        "Company settings not configured. Please configure company details in Settings first.",
      );
      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should fetch RCTI with lines ordered by jobDate and required includes", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(
        mockSettings,
      );
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(
        createPdfStream(),
      );

      const request = createMockRequest();
      const params = Promise.resolve({ id: "1" });

      await POST(request, { params });

      expect(prisma.rcti.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          lines: {
            orderBy: { jobDate: "asc" },
          },
          driver: true,
          deductionApplications: {
            include: {
              deduction: {
                select: {
                  id: true,
                  type: true,
                  description: true,
                  frequency: true,
                  totalAmount: true,
                  amountPaid: true,
                  amountRemaining: true,
                },
              },
            },
          },
        },
      });
    });

    it("should send email successfully for finalised RCTI with attachment", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(
        mockSettings,
      );
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(
        createPdfStream(),
      );

      const request = createMockRequest();
      const params = Promise.resolve({ id: "1" });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        messageId: "msg-123",
        sentTo: "driver@example.com",
      });

      expect(mockBuildRctiEmailSubjectLine).toHaveBeenCalledWith({
        weekEnding: mockRcti.weekEnding.toISOString(),
        companyName: mockSettings.companyName,
      });

      expect(mockBuildRctiEmailHtml).toHaveBeenCalledWith({
        data: {
          companyName: mockSettings.companyName,
          companyAbn: mockSettings.companyAbn,
          companyAddress: mockSettings.companyAddress,
          companyPhone: mockSettings.companyPhone,
          companyEmail: mockSettings.companyEmail,
          companyLogoUrl: null,
          invoiceNumber: mockRcti.invoiceNumber,
          driverName: mockRcti.driverName,
          weekEnding: mockRcti.weekEnding.toISOString(),
          total: "1100.00",
          status: mockRcti.status,
        },
      });

      expect(mockSendEmail).toHaveBeenCalledWith({
        to: "driver@example.com",
        subject: "RCTI for week ending 20 Jan 2025 - Test Company Pty Ltd",
        html: "<html><body>Test email</body></html>",
        replyTo: "accounts@testcompany.com.au",
        attachment: {
          data: expect.any(Buffer),
          filename: "RCTI-20012025.pdf",
          contentType: "application/pdf",
        },
      });

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });

    it("should allow paid RCTI status for emailing", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue({
        ...mockRcti,
        status: "paid",
      });
      (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(
        mockSettings,
      );
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(
        createPdfStream(),
      );

      const request = createMockRequest();
      const params = Promise.resolve({ id: "1" });

      const response = await POST(request, { params });

      expect(response.status).toBe(200);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });

    it("should fallback replyTo to companyEmail when emailReplyTo is missing", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue({
        ...mockSettings,
        emailReplyTo: null,
      });
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(
        createPdfStream(),
      );

      const request = createMockRequest();
      const params = Promise.resolve({ id: "1" });

      await POST(request, { params });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: "info@testcompany.com.au",
        }),
      );
    });

    it("should omit replyTo when both emailReplyTo and companyEmail are missing", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue({
        ...mockSettings,
        emailReplyTo: null,
        companyEmail: null,
      });
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(
        createPdfStream(),
      );

      const request = createMockRequest();
      const params = Promise.resolve({ id: "1" });

      await POST(request, { params });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: undefined,
        }),
      );
    });

    it("should return 500 when sendEmail returns unsuccessful result with message", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(
        mockSettings,
      );
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(
        createPdfStream(),
      );
      mockSendEmail.mockResolvedValue({
        success: false,
        error: "Mail provider rejected request",
      });

      const request = createMockRequest();
      const params = Promise.resolve({ id: "1" });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Mail provider rejected request");
      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });

    it("should return 500 with default error when sendEmail fails without message", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(
        mockSettings,
      );
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(
        createPdfStream(),
      );
      mockSendEmail.mockResolvedValue({
        success: false,
      });

      const request = createMockRequest();
      const params = Promise.resolve({ id: "1" });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to send email");
    });

    it("should return 500 when PDF rendering throws", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(
        mockSettings,
      );
      (ReactPDF.renderToStream as jest.Mock).mockRejectedValue(
        new Error("PDF generation failed"),
      );

      const request = createMockRequest();
      const params = Promise.resolve({ id: "1" });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to send RCTI email");
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should build logo data URL and public URL for uploads path", async () => {
      const logoBuffer = Buffer.from("fake-image-data");
      mockReadFile.mockResolvedValue(logoBuffer);

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue({
        ...mockSettings,
        companyLogo: "/uploads/company-logo.png",
      });
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(
        createPdfStream(),
      );

      const request = createMockRequest({ host: "app.example.com" });
      const params = Promise.resolve({ id: "1" });

      await POST(request, { params });

      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining("public/uploads/company-logo.png"),
      );

      expect(mockBuildRctiEmailHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyLogoUrl: "https://app.example.com/uploads/company-logo.png",
          }),
        }),
      );
    });
  });
});
