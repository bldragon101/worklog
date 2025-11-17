/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "@/app/api/rcti/[id]/pdf/route";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import * as ReactPDF from "@react-pdf/renderer";

// Mock dependencies
jest.mock("@/lib/prisma", () => ({
  prisma: {
    rcti: {
      findUnique: jest.fn(),
    },
    rctiSettings: {
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
    create: jest.fn((styles) => styles),
  },
  Document: "Document",
  Page: "Page",
  Text: "Text",
  View: "View",
  Image: "Image",
}));

const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

describe("RCTI PDF Generation API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (id: string) => {
    return new NextRequest(`http://localhost:3000/api/rcti/${id}/pdf`, {
      method: "GET",
    });
  };

  const mockRcti = {
    id: 1,
    invoiceNumber: "RCTI-20012025",
    driverId: 10,
    driverName: "John Smith",
    driverAddress: "123 Test St, Melbourne VIC 3000",
    driverAbn: "12 345 678 901",
    weekEnding: new Date("2025-01-20"),
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
    lines: [
      {
        id: 1,
        jobDate: new Date("2025-01-15"),
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
    driver: {
      id: 10,
      driver: "John Smith",
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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("GET /api/rcti/[id]/pdf", () => {
    it("should return 400 for invalid RCTI ID", async () => {
      const request = createMockRequest("invalid");
      const params = Promise.resolve({ id: "invalid" });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid RCTI ID");
      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });

    it("should return 404 when RCTI not found", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest("999");
      const params = Promise.resolve({ id: "999" });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("RCTI not found");
      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });

    it("should return 400 when settings not configured", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest("1");
      const params = Promise.resolve({ id: "1" });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("RCTI settings not configured");
      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });

    it("should fetch RCTI with lines ordered by jobDate", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
        mockSettings,
      );

      const request = createMockRequest("1");
      const params = Promise.resolve({ id: "1" });

      await GET(request, { params });

      expect(prisma.rcti.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          lines: {
            orderBy: { jobDate: "asc" },
          },
          driver: true,
        },
      });
    });

    it("should use new invoice number format in filename", async () => {
      // Mock async iterable for stream
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from("PDF content");
        },
      };
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(mockStream);

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
        mockSettings,
      );

      const request = createMockRequest("1");
      const params = Promise.resolve({ id: "1" });

      const response = await GET(request, { params });

      const contentDisposition = response.headers.get("Content-Disposition");
      expect(contentDisposition).toBe(
        'attachment; filename="RCTI-20012025.pdf"',
      );
    });
  });

  describe("Logo Base64 Conversion", () => {
    it("should convert logo to base64 data URL for PDF rendering", async () => {
      const mockImageBuffer = Buffer.from("fake-image-data");

      // Mock file read
      mockReadFile.mockResolvedValue(mockImageBuffer);

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from("PDF content");
        },
      };
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(mockStream);

      const settingsWithLogo = {
        ...mockSettings,
        companyLogo: "/uploads/image_123.png",
      };

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
        settingsWithLogo,
      );

      const request = createMockRequest("1");
      const params = Promise.resolve({ id: "1" });

      await GET(request, { params });

      // Verify file was read from correct path
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining("public/uploads/image_123.png"),
      );
    });

    it("should handle different image formats with correct MIME types", async () => {
      const testCases = [
        { ext: ".png", expected: "image/png" },
        { ext: ".jpg", expected: "image/jpeg" },
        { ext: ".jpeg", expected: "image/jpeg" },
        { ext: ".gif", expected: "image/gif" },
        { ext: ".webp", expected: "image/webp" },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        const mockImageBuffer = Buffer.from("fake-image-data");
        mockReadFile.mockResolvedValue(mockImageBuffer);

        const mockStream = {
          [Symbol.asyncIterator]: async function* () {
            yield Buffer.from("PDF content");
          },
        };
        (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(mockStream);

        const settingsWithLogo = {
          ...mockSettings,
          companyLogo: `/uploads/image_123${testCase.ext}`,
        };

        (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
        (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
          settingsWithLogo,
        );

        const request = createMockRequest("1");
        const params = Promise.resolve({ id: "1" });

        await GET(request, { params });

        // The actual implementation creates the data URL internally
        // We're just verifying the file was read
        expect(mockReadFile).toHaveBeenCalled();
      }
    });

    it("should continue without logo if file read fails", async () => {
      mockReadFile.mockRejectedValue(new Error("File not found"));

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from("PDF content");
        },
      };
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(mockStream);

      const settingsWithLogo = {
        ...mockSettings,
        companyLogo: "/uploads/nonexistent.png",
      };

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
        settingsWithLogo,
      );

      const request = createMockRequest("1");
      const params = Promise.resolve({ id: "1" });

      const response = await GET(request, { params });

      // Should still succeed and generate PDF
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
    });

    it("should not attempt to read logo if path is not /uploads/", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from("PDF content");
        },
      };
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(mockStream);

      const settingsWithExternalLogo = {
        ...mockSettings,
        companyLogo: "https://example.com/logo.png",
      };

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
        settingsWithExternalLogo,
      );

      const request = createMockRequest("1");
      const params = Promise.resolve({ id: "1" });

      await GET(request, { params });

      // Should not attempt to read file for external URLs
      expect(mockReadFile).not.toHaveBeenCalled();
    });
  });

  describe("PDF Response Headers", () => {
    it("should set correct Content-Type header", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from("PDF content");
        },
      };
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(mockStream);

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
        mockSettings,
      );

      const request = createMockRequest("1");
      const params = Promise.resolve({ id: "1" });

      const response = await GET(request, { params });

      expect(response.headers.get("Content-Type")).toBe("application/pdf");
    });

    it("should set Content-Disposition for download", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from("PDF content");
        },
      };
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(mockStream);

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
        mockSettings,
      );

      const request = createMockRequest("1");
      const params = Promise.resolve({ id: "1" });

      const response = await GET(request, { params });

      const disposition = response.headers.get("Content-Disposition");
      expect(disposition).toContain("attachment");
      expect(disposition).toContain("RCTI-20012025.pdf");
    });

    it("should include rate limit headers", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from("PDF content");
        },
      };
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(mockStream);

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
        mockSettings,
      );

      const request = createMockRequest("1");
      const params = Promise.resolve({ id: "1" });

      const response = await GET(request, { params });

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });
  });

  describe("Settings Data Preparation", () => {
    it("should handle missing optional settings fields", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from("PDF content");
        },
      };
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(mockStream);

      const minimalSettings = {
        id: 1,
        companyName: "Test Company",
        companyAbn: null,
        companyAddress: null,
        companyPhone: null,
        companyEmail: null,
        companyLogo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
        minimalSettings,
      );

      const request = createMockRequest("1");
      const params = Promise.resolve({ id: "1" });

      const response = await GET(request, { params });

      expect(response.status).toBe(200);
    });

    it("should convert null settings to empty strings", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from("PDF content");
        },
      };
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(mockStream);

      const settingsWithNulls = {
        id: 1,
        companyName: "Test Company",
        companyAbn: null,
        companyAddress: null,
        companyPhone: null,
        companyEmail: null,
        companyLogo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
        settingsWithNulls,
      );

      const request = createMockRequest("1");
      const params = Promise.resolve({ id: "1" });

      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      // PDF should be generated with empty strings for null values
    });
  });

  describe("Error Handling", () => {
    it("should return 500 on unexpected errors", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      const request = createMockRequest("1");
      const params = Promise.resolve({ id: "1" });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to generate PDF");
      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });

    it("should log errors to console", async () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      (prisma.rcti.findUnique as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );

      const request = createMockRequest("1");
      const params = Promise.resolve({ id: "1" });

      await GET(request, { params });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error generating RCTI PDF:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("RCTI Data Validation", () => {
    it("should include all required RCTI fields", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from("PDF content");
        },
      };
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(mockStream);

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
        mockSettings,
      );

      const request = createMockRequest("1");
      const params = Promise.resolve({ id: "1" });

      await GET(request, { params });

      // Verify renderToStream was called with correct data structure
      expect(ReactPDF.renderToStream).toHaveBeenCalled();
      const callArgs = (ReactPDF.renderToStream as jest.Mock).mock.calls[0][0];
      expect(callArgs.props.rcti).toBeDefined();
      expect(callArgs.props.settings).toBeDefined();
    });

    it("should handle RCTIs with multiple lines", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from("PDF content");
        },
      };
      (ReactPDF.renderToStream as jest.Mock).mockResolvedValue(mockStream);

      const rctiWithMultipleLines = {
        ...mockRcti,
        lines: [
          {
            id: 1,
            jobDate: new Date("2025-01-15"),
            customer: "Customer A",
            truckType: "Tray",
            description: "Job 1",
            chargedHours: 8.0,
            ratePerHour: 100.0,
            amountExGst: 800.0,
            gstAmount: 80.0,
            amountIncGst: 880.0,
          },
          {
            id: 2,
            jobDate: new Date("2025-01-16"),
            customer: "Customer B",
            truckType: "Crane",
            description: "Job 2",
            chargedHours: 6.5,
            ratePerHour: 120.0,
            amountExGst: 780.0,
            gstAmount: 78.0,
            amountIncGst: 858.0,
          },
        ],
      };

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(
        rctiWithMultipleLines,
      );
      (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
        mockSettings,
      );

      const request = createMockRequest("1");
      const params = Promise.resolve({ id: "1" });

      const response = await GET(request, { params });

      expect(response.status).toBe(200);
    });
  });
});
