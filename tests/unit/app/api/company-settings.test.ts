/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/company-settings/route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    companySettings: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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

describe("Company Settings API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = ({
    method,
    body,
  }: {
    method: string;
    body?: unknown;
  }) => {
    if (body) {
      return new NextRequest("http://localhost:3000/api/company-settings", {
        method,
        body: JSON.stringify(body),
      });
    }
    return new NextRequest("http://localhost:3000/api/company-settings", {
      method,
    });
  };

  const mockSettings = {
    id: 1,
    companyName: "Test Company Pty Ltd",
    companyAbn: "98 765 432 109",
    companyAddress: "456 Business Rd, Melbourne VIC 3001",
    companyPhone: "(03) 9876 5432",
    companyEmail: "info@testcompany.com.au",
    companyLogo: "https://example.com/uploads/logo.png",
    emailReplyTo: "accounts@testcompany.com.au",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("GET /api/company-settings", () => {
    it("should return existing settings", async () => {
      (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(
        mockSettings,
      );

      const request = createMockRequest({ method: "GET" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.companyName).toBe(mockSettings.companyName);
      expect(data.companyAbn).toBe(mockSettings.companyAbn);
      expect(data.companyAddress).toBe(mockSettings.companyAddress);
      expect(data.companyPhone).toBe(mockSettings.companyPhone);
      expect(data.companyEmail).toBe(mockSettings.companyEmail);
      expect(data.companyLogo).toBe(mockSettings.companyLogo);
      expect(data.emailReplyTo).toBe(mockSettings.emailReplyTo);
    });

    it("should return default empty settings when none exist", async () => {
      (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest({ method: "GET" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        companyName: "",
        companyAbn: null,
        companyAddress: null,
        companyPhone: null,
        companyEmail: null,
        companyLogo: null,
        emailReplyTo: null,
      });
    });

    it("should include rate limit headers", async () => {
      (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(
        mockSettings,
      );

      const request = createMockRequest({ method: "GET" });
      const response = await GET(request);

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });

    it("should return 500 on database error", async () => {
      (prisma.companySettings.findFirst as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      const request = createMockRequest({ method: "GET" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch company settings");
    });
  });

  describe("POST /api/company-settings", () => {
    const validSettings = {
      companyName: "New Company Pty Ltd",
      companyAbn: "12 345 678 901",
      companyAddress: "789 New St, Sydney NSW 2000",
      companyPhone: "(02) 1234 5678",
      companyEmail: "contact@newcompany.com.au",
      companyLogo: "https://example.com/uploads/new-logo.png",
      emailReplyTo: "reply@newcompany.com.au",
    };

    describe("Zod validation", () => {
      it("should reject empty company name", async () => {
        const request = createMockRequest({
          method: "POST",
          body: { ...validSettings, companyName: "" },
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Validation failed");
        expect(data.fieldErrors).toBeDefined();
      });

      it("should reject whitespace-only company name", async () => {
        const request = createMockRequest({
          method: "POST",
          body: { ...validSettings, companyName: "   " },
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Validation failed");
      });

      it("should reject missing company name field", async () => {
        const { companyName: _, ...noName } = validSettings;
        const request = createMockRequest({
          method: "POST",
          body: noName,
        });
        const response = await POST(request);

        expect(response.status).toBe(400);
      });

      it("should reject company name exceeding 255 characters", async () => {
        const request = createMockRequest({
          method: "POST",
          body: { ...validSettings, companyName: "A".repeat(256) },
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Validation failed");
      });

      it("should accept company name at exactly 255 characters", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.companySettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          ...validSettings,
          companyName: "A".repeat(255),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createMockRequest({
          method: "POST",
          body: { ...validSettings, companyName: "A".repeat(255) },
        });
        const response = await POST(request);

        expect(response.status).toBe(201);
      });

      it("should reject invalid email format for companyEmail", async () => {
        const request = createMockRequest({
          method: "POST",
          body: { ...validSettings, companyEmail: "not-an-email" },
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Validation failed");
        expect(data.fieldErrors.companyEmail).toBeDefined();
      });

      it("should reject invalid email format for emailReplyTo", async () => {
        const request = createMockRequest({
          method: "POST",
          body: { ...validSettings, emailReplyTo: "bad-email" },
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.fieldErrors.emailReplyTo).toBeDefined();
      });

      it("should accept valid email addresses", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.companySettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          ...validSettings,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createMockRequest({
          method: "POST",
          body: validSettings,
        });
        const response = await POST(request);

        expect(response.status).toBe(201);
      });

      it("should accept null companyEmail", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.companySettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          ...validSettings,
          companyEmail: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createMockRequest({
          method: "POST",
          body: { ...validSettings, companyEmail: null },
        });
        const response = await POST(request);

        expect(response.status).toBe(201);
      });

      it("should reject invalid URL format for companyLogo", async () => {
        const request = createMockRequest({
          method: "POST",
          body: { ...validSettings, companyLogo: "not-a-url" },
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.fieldErrors.companyLogo).toBeDefined();
      });

      it("should accept valid URL for companyLogo", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.companySettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          ...validSettings,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createMockRequest({
          method: "POST",
          body: {
            ...validSettings,
            companyLogo: "https://blob.vercel-storage.com/uploads/logo.png",
          },
        });
        const response = await POST(request);

        expect(response.status).toBe(201);
      });

      it("should accept null companyLogo", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.companySettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          ...validSettings,
          companyLogo: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createMockRequest({
          method: "POST",
          body: { ...validSettings, companyLogo: null },
        });
        const response = await POST(request);

        expect(response.status).toBe(201);
      });

      it("should return 400 for invalid JSON body", async () => {
        const request = new NextRequest(
          "http://localhost:3000/api/company-settings",
          {
            method: "POST",
            body: "not-json{{{",
            headers: { "Content-Type": "application/json" },
          },
        );
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Invalid request body");
      });
    });

    describe("field normalisation", () => {
      it("should trim whitespace from company name", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.companySettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          ...validSettings,
          companyName: "Trimmed Company",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createMockRequest({
          method: "POST",
          body: { ...validSettings, companyName: "  Trimmed Company  " },
        });
        await POST(request);

        expect(prisma.companySettings.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            companyName: "Trimmed Company",
          }),
        });
      });

      it("should normalise empty string optional fields to null", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.companySettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          companyName: "Test Company",
          companyAbn: null,
          companyAddress: null,
          companyPhone: null,
          companyEmail: null,
          companyLogo: null,
          emailReplyTo: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createMockRequest({
          method: "POST",
          body: {
            companyName: "Test Company",
            companyAbn: "",
            companyAddress: "",
            companyPhone: "",
            companyEmail: "",
            companyLogo: "",
            emailReplyTo: "",
          },
        });
        await POST(request);

        expect(prisma.companySettings.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            companyAbn: null,
            companyAddress: null,
            companyPhone: null,
            companyEmail: null,
            companyLogo: null,
            emailReplyTo: null,
          }),
        });
      });

      it("should normalise whitespace-only optional fields to null", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.companySettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          companyName: "Test Company",
          companyAbn: null,
          companyAddress: null,
          companyPhone: null,
          companyEmail: null,
          companyLogo: null,
          emailReplyTo: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createMockRequest({
          method: "POST",
          body: {
            companyName: "Test Company",
            companyAbn: "   ",
            companyAddress: "   ",
            companyPhone: "   ",
          },
        });
        await POST(request);

        expect(prisma.companySettings.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            companyAbn: null,
            companyAddress: null,
            companyPhone: null,
          }),
        });
      });

      it("should trim whitespace from optional string fields", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.companySettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          ...validSettings,
          companyAbn: "12 345 678 901",
          companyAddress: "123 Test St",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createMockRequest({
          method: "POST",
          body: {
            ...validSettings,
            companyAbn: "  12 345 678 901  ",
            companyAddress: "  123 Test St  ",
          },
        });
        await POST(request);

        expect(prisma.companySettings.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            companyAbn: "12 345 678 901",
            companyAddress: "123 Test St",
          }),
        });
      });
    });

    describe("creating settings", () => {
      it("should create new settings when none exist and return 201", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.companySettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          ...validSettings,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createMockRequest({
          method: "POST",
          body: validSettings,
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.companyName).toBe(validSettings.companyName);
        expect(prisma.companySettings.create).toHaveBeenCalled();
        expect(prisma.companySettings.update).not.toHaveBeenCalled();
      });

      it("should handle minimal settings with only companyName", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.companySettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          companyName: "Minimal Company",
          companyAbn: null,
          companyAddress: null,
          companyPhone: null,
          companyEmail: null,
          companyLogo: null,
          emailReplyTo: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createMockRequest({
          method: "POST",
          body: { companyName: "Minimal Company" },
        });
        const response = await POST(request);

        expect(response.status).toBe(201);
        expect(prisma.companySettings.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            companyName: "Minimal Company",
            companyAbn: null,
            companyAddress: null,
            companyPhone: null,
            companyEmail: null,
            companyLogo: null,
            emailReplyTo: null,
          }),
        });
      });
    });

    describe("updating settings", () => {
      it("should update existing settings and return 200", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(
          mockSettings,
        );
        (prisma.companySettings.update as jest.Mock).mockResolvedValue({
          ...mockSettings,
          ...validSettings,
        });

        const request = createMockRequest({
          method: "POST",
          body: validSettings,
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.companyName).toBe(validSettings.companyName);
        expect(prisma.companySettings.update).toHaveBeenCalledWith({
          where: { id: mockSettings.id },
          data: expect.objectContaining({
            companyName: validSettings.companyName,
          }),
        });
        expect(prisma.companySettings.create).not.toHaveBeenCalled();
      });

      it("should only include provided fields in update data", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(
          mockSettings,
        );
        (prisma.companySettings.update as jest.Mock).mockResolvedValue({
          ...mockSettings,
          companyName: "Updated Name",
        });

        const request = createMockRequest({
          method: "POST",
          body: { companyName: "Updated Name" },
        });
        await POST(request);

        const updateCall = (prisma.companySettings.update as jest.Mock).mock
          .calls[0][0];
        expect(updateCall.data.companyName).toBe("Updated Name");
      });

      it("should set optional fields to null when provided as empty string during update", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(
          mockSettings,
        );
        (prisma.companySettings.update as jest.Mock).mockResolvedValue({
          ...mockSettings,
          companyAbn: null,
          companyPhone: null,
        });

        const request = createMockRequest({
          method: "POST",
          body: {
            companyName: "Test Company",
            companyAbn: "",
            companyPhone: "",
          },
        });
        await POST(request);

        expect(prisma.companySettings.update).toHaveBeenCalledWith({
          where: { id: mockSettings.id },
          data: expect.objectContaining({
            companyAbn: null,
            companyPhone: null,
          }),
        });
      });
    });

    describe("special characters", () => {
      it("should handle special characters in company name", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.companySettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          companyName: "O'Brien & Sons Pty Ltd",
          companyAbn: null,
          companyAddress: null,
          companyPhone: null,
          companyEmail: null,
          companyLogo: null,
          emailReplyTo: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createMockRequest({
          method: "POST",
          body: { companyName: "O'Brien & Sons Pty Ltd" },
        });
        const response = await POST(request);

        expect(response.status).toBe(201);
      });

      it("should handle Australian address format with unit notation", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.companySettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          companyName: "Test Co",
          companyAddress: "Unit 5/123 Smith's Lane, St Kilda VIC 3182",
          companyAbn: null,
          companyPhone: null,
          companyEmail: null,
          companyLogo: null,
          emailReplyTo: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createMockRequest({
          method: "POST",
          body: {
            companyName: "Test Co",
            companyAddress: "Unit 5/123 Smith's Lane, St Kilda VIC 3182",
          },
        });
        const response = await POST(request);

        expect(response.status).toBe(201);
      });
    });

    describe("error handling", () => {
      it("should return 500 on database error during creation", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.companySettings.create as jest.Mock).mockRejectedValue(
          new Error("Database error"),
        );

        const request = createMockRequest({
          method: "POST",
          body: validSettings,
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe("Failed to save company settings");
      });

      it("should return 500 on database error during update", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(
          mockSettings,
        );
        (prisma.companySettings.update as jest.Mock).mockRejectedValue(
          new Error("Database error"),
        );

        const request = createMockRequest({
          method: "POST",
          body: validSettings,
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe("Failed to save company settings");
      });

      it("should include rate limit headers in validation error responses", async () => {
        const request = createMockRequest({
          method: "POST",
          body: { companyName: "" },
        });
        const response = await POST(request);

        expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
        expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
      });

      it("should include rate limit headers on successful responses", async () => {
        (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.companySettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          ...validSettings,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createMockRequest({
          method: "POST",
          body: validSettings,
        });
        const response = await POST(request);

        expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
        expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
      });

      it("should log error to console on database failure", async () => {
        const consoleSpy = jest
          .spyOn(console, "error")
          .mockImplementation();

        const dbError = new Error("Connection lost");
        (prisma.companySettings.findFirst as jest.Mock).mockRejectedValue(
          dbError,
        );

        const request = createMockRequest({ method: "GET" });
        await GET(request);

        expect(consoleSpy).toHaveBeenCalledWith(
          "Error fetching company settings:",
          dbError,
        );

        consoleSpy.mockRestore();
      });
    });
  });
});
