/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/rcti-settings/route";
import { prisma } from "@/lib/prisma";

// Mock dependencies
jest.mock("@/lib/prisma", () => ({
  prisma: {
    rctiSettings: {
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

describe("RCTI Settings API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (method: string, body?: unknown) => {
    if (body) {
      return new NextRequest("http://localhost:3000/api/rcti-settings", {
        method,
        body: JSON.stringify(body),
      });
    }
    return new NextRequest("http://localhost:3000/api/rcti-settings", {
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
    companyLogo: "/uploads/logo.png",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("GET /api/rcti-settings", () => {
    it("should return existing settings", async () => {
      (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
        mockSettings,
      );

      const request = createMockRequest("GET");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.companyName).toBe(mockSettings.companyName);
      expect(data.companyAbn).toBe(mockSettings.companyAbn);
      expect(data.companyAddress).toBe(mockSettings.companyAddress);
      expect(data.companyPhone).toBe(mockSettings.companyPhone);
      expect(data.companyEmail).toBe(mockSettings.companyEmail);
      expect(data.companyLogo).toBe(mockSettings.companyLogo);
    });

    it("should return default empty settings when none exist", async () => {
      (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest("GET");
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
      });
    });

    it("should include rate limit headers", async () => {
      (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
        mockSettings,
      );

      const request = createMockRequest("GET");
      const response = await GET(request);

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });

    it("should return 500 on database error", async () => {
      (prisma.rctiSettings.findFirst as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      const request = createMockRequest("GET");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch RCTI settings");
    });
  });

  describe("POST /api/rcti-settings", () => {
    const validSettings = {
      companyName: "New Company Pty Ltd",
      companyAbn: "12 345 678 901",
      companyAddress: "789 New St, Sydney NSW 2000",
      companyPhone: "(02) 1234 5678",
      companyEmail: "contact@newcompany.com.au",
      companyLogo: "/uploads/new-logo.png",
    };

    describe("Validation", () => {
      it("should require company name", async () => {
        const invalidSettings = {
          ...validSettings,
          companyName: "",
        };

        const request = createMockRequest("POST", invalidSettings);
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Company name is required");
      });

      it("should reject whitespace-only company name", async () => {
        const invalidSettings = {
          ...validSettings,
          companyName: "   ",
        };

        const request = createMockRequest("POST", invalidSettings);
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Company name is required");
      });

      it("should trim whitespace from all fields", async () => {
        (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.rctiSettings.create as jest.Mock).mockResolvedValue({
          ...mockSettings,
          companyName: "Test Company",
        });

        const settingsWithWhitespace = {
          companyName: "  Test Company  ",
          companyAbn: "  12 345 678 901  ",
          companyAddress: "  123 Test St  ",
          companyPhone: "  (03) 1234 5678  ",
          companyEmail: "  test@test.com  ",
          companyLogo: "  /uploads/logo.png  ",
        };

        const request = createMockRequest("POST", settingsWithWhitespace);
        await POST(request);

        expect(prisma.rctiSettings.create).toHaveBeenCalledWith({
          data: {
            companyName: "Test Company",
            companyAbn: "12 345 678 901",
            companyAddress: "123 Test St",
            companyPhone: "(03) 1234 5678",
            companyEmail: "test@test.com",
            companyLogo: "/uploads/logo.png",
          },
        });
      });
    });

    describe("Creating Settings", () => {
      it("should create new settings when none exist", async () => {
        (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.rctiSettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          ...validSettings,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createMockRequest("POST", validSettings);
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.companyName).toBe(validSettings.companyName);
        expect(prisma.rctiSettings.create).toHaveBeenCalled();
      });

      it("should handle null optional fields when creating", async () => {
        (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.rctiSettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          companyName: "Test Company",
          companyAbn: null,
          companyAddress: null,
          companyPhone: null,
          companyEmail: null,
          companyLogo: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const minimalSettings = {
          companyName: "Test Company",
        };

        const request = createMockRequest("POST", minimalSettings);
        const response = await POST(request);

        expect(response.status).toBe(201);
        expect(prisma.rctiSettings.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            companyName: "Test Company",
            companyAbn: null,
            companyAddress: null,
            companyPhone: null,
            companyEmail: null,
            companyLogo: null,
          }),
        });
      });
    });

    describe("Updating Settings", () => {
      it("should update existing settings", async () => {
        (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
          mockSettings,
        );
        (prisma.rctiSettings.update as jest.Mock).mockResolvedValue({
          ...mockSettings,
          ...validSettings,
        });

        const request = createMockRequest("POST", validSettings);
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.companyName).toBe(validSettings.companyName);
        expect(prisma.rctiSettings.update).toHaveBeenCalledWith({
          where: { id: mockSettings.id },
          data: expect.objectContaining({
            companyName: validSettings.companyName,
          }),
        });
      });

      it("should handle empty string fields as null when updating", async () => {
        (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
          mockSettings,
        );
        (prisma.rctiSettings.update as jest.Mock).mockResolvedValue({
          ...mockSettings,
          companyAbn: null,
        });

        const settingsWithEmptyStrings = {
          companyName: "Test Company",
          companyAbn: "",
          companyAddress: "",
          companyPhone: "",
          companyEmail: "",
          companyLogo: "",
        };

        const request = createMockRequest("POST", settingsWithEmptyStrings);
        await POST(request);

        expect(prisma.rctiSettings.update).toHaveBeenCalledWith({
          where: { id: mockSettings.id },
          data: expect.objectContaining({
            companyAbn: null,
            companyAddress: null,
            companyPhone: null,
            companyEmail: null,
            companyLogo: null,
          }),
        });
      });

      it("should preserve existing logo when not provided", async () => {
        (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
          mockSettings,
        );
        (prisma.rctiSettings.update as jest.Mock).mockResolvedValue({
          ...mockSettings,
          companyName: "Updated Company",
        });

        const updateWithoutLogo = {
          companyName: "Updated Company",
          companyAbn: "12 345 678 901",
        };

        const request = createMockRequest("POST", updateWithoutLogo);
        await POST(request);

        expect(prisma.rctiSettings.update).toHaveBeenCalled();
      });
    });

    describe("Australian English Compliance", () => {
      it("should handle Australian English spelling in settings", async () => {
        (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.rctiSettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          ...validSettings,
          companyAddress: "123 Centre Rd, Melbourne VIC 3000",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const australianSettings = {
          companyName: "Test Company",
          companyAddress: "123 Centre Rd, Melbourne VIC 3000",
        };

        const request = createMockRequest("POST", australianSettings);
        const response = await POST(request);

        expect(response.status).toBe(201);
      });
    });

    describe("Logo Handling", () => {
      it("should accept valid logo paths", async () => {
        (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.rctiSettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          ...validSettings,
          companyLogo: "/uploads/company-logo.png",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const settingsWithLogo = {
          companyName: "Test Company",
          companyLogo: "/uploads/company-logo.png",
        };

        const request = createMockRequest("POST", settingsWithLogo);
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.companyLogo).toBe("/uploads/company-logo.png");
      });

      it("should handle removing logo by setting to empty string", async () => {
        (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
          mockSettings,
        );
        (prisma.rctiSettings.update as jest.Mock).mockResolvedValue({
          ...mockSettings,
          companyLogo: null,
        });

        const removeLogo = {
          companyName: "Test Company",
          companyLogo: "",
        };

        const request = createMockRequest("POST", removeLogo);
        await POST(request);

        expect(prisma.rctiSettings.update).toHaveBeenCalledWith({
          where: { id: mockSettings.id },
          data: expect.objectContaining({
            companyLogo: null,
          }),
        });
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error during creation", async () => {
        (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.rctiSettings.create as jest.Mock).mockRejectedValue(
          new Error("Database error"),
        );

        const request = createMockRequest("POST", validSettings);
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe("Failed to save RCTI settings");
      });

      it("should return 500 on database error during update", async () => {
        (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(
          mockSettings,
        );
        (prisma.rctiSettings.update as jest.Mock).mockRejectedValue(
          new Error("Database error"),
        );

        const request = createMockRequest("POST", validSettings);
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe("Failed to save RCTI settings");
      });

      it("should include rate limit headers in error responses", async () => {
        const request = createMockRequest("POST", { companyName: "" });
        const response = await POST(request);

        expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
        expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
      });
    });

    describe("Rate Limiting", () => {
      it("should include rate limit headers on success", async () => {
        (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.rctiSettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          ...validSettings,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createMockRequest("POST", validSettings);
        const response = await POST(request);

        expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
        expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
      });
    });

    describe("Special Characters", () => {
      it("should handle special characters in company details", async () => {
        (prisma.rctiSettings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.rctiSettings.create as jest.Mock).mockResolvedValue({
          id: 1,
          companyName: "O'Brien & Sons Pty Ltd",
          companyAddress: "Unit 5/123 Smith's Lane, St Kilda VIC 3182",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const specialCharSettings = {
          companyName: "O'Brien & Sons Pty Ltd",
          companyAddress: "Unit 5/123 Smith's Lane, St Kilda VIC 3182",
        };

        const request = createMockRequest("POST", specialCharSettings);
        const response = await POST(request);

        expect(response.status).toBe(201);
      });
    });
  });
});
