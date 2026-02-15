/**
 * @jest-environment node
 */

const mockSend = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

import { sendEmail } from "@/lib/resend";

describe("resend sendEmail", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      RESEND_API_KEY: "re_test_abc123",
      RESEND_DOMAIN: "mg.example.com.au",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const baseParams = {
    to: "driver@example.com",
    subject: "RCTI W/E 15.06.2025 from Test Co",
    html: "<h1>Hello</h1>",
  };

  describe("environment variable validation", () => {
    it("should return error when RESEND_API_KEY is not configured", async () => {
      process.env.RESEND_API_KEY = "";

      const result = await sendEmail(baseParams);

      expect(result).toEqual({
        success: false,
        error: "RESEND_API_KEY is not configured",
      });
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("should return error when RESEND_API_KEY is undefined", async () => {
      const { RESEND_API_KEY: _, ...envWithout } = process.env;
      process.env = envWithout;

      const result = await sendEmail(baseParams);

      expect(result).toEqual({
        success: false,
        error: "RESEND_API_KEY is not configured",
      });
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("should return error when RESEND_DOMAIN is not configured", async () => {
      process.env.RESEND_DOMAIN = "";

      const result = await sendEmail(baseParams);

      expect(result).toEqual({
        success: false,
        error: "RESEND_DOMAIN is not configured",
      });
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("should return error when RESEND_DOMAIN is undefined", async () => {
      const { RESEND_DOMAIN: _, ...envWithout } = process.env;
      process.env = envWithout;

      const result = await sendEmail(baseParams);

      expect(result).toEqual({
        success: false,
        error: "RESEND_DOMAIN is not configured",
      });
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe("successful email sending", () => {
    it("should send email and return success with messageId", async () => {
      mockSend.mockResolvedValue({
        data: { id: "msg_abc123" },
        error: null,
      });

      const result = await sendEmail(baseParams);

      expect(result).toEqual({
        success: true,
        messageId: "msg_abc123",
      });
    });

    it("should construct from address using RCTI default and domain", async () => {
      mockSend.mockResolvedValue({
        data: { id: "msg_123" },
        error: null,
      });

      await sendEmail(baseParams);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "RCTI <rcti@mg.example.com.au>",
        }),
      );
    });

    it("should use custom fromName in from address", async () => {
      mockSend.mockResolvedValue({
        data: { id: "msg_123" },
        error: null,
      });

      await sendEmail({ ...baseParams, fromName: "Acme Transport" });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "Acme Transport <rcti@mg.example.com.au>",
        }),
      );
    });

    it("should trim whitespace from fromName", async () => {
      mockSend.mockResolvedValue({
        data: { id: "msg_123" },
        error: null,
      });

      await sendEmail({ ...baseParams, fromName: "  Padded Name  " });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "Padded Name <rcti@mg.example.com.au>",
        }),
      );
    });

    it("should fall back to RCTI when fromName is whitespace only", async () => {
      mockSend.mockResolvedValue({
        data: { id: "msg_123" },
        error: null,
      });

      await sendEmail({ ...baseParams, fromName: "   " });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "RCTI <rcti@mg.example.com.au>",
        }),
      );
    });

    it("should pass to, subject, and html fields to Resend", async () => {
      mockSend.mockResolvedValue({
        data: { id: "msg_123" },
        error: null,
      });

      await sendEmail(baseParams);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "driver@example.com",
          subject: "RCTI W/E 15.06.2025 from Test Co",
          html: "<h1>Hello</h1>",
        }),
      );
    });

    it("should pass replyTo when provided", async () => {
      mockSend.mockResolvedValue({
        data: { id: "msg_123" },
        error: null,
      });

      await sendEmail({ ...baseParams, replyTo: "reply@example.com" });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: "reply@example.com",
        }),
      );
    });

    it("should pass undefined for replyTo when not provided", async () => {
      mockSend.mockResolvedValue({
        data: { id: "msg_123" },
        error: null,
      });

      await sendEmail(baseParams);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: undefined,
        }),
      );
    });

    it("should pass undefined for replyTo when empty string", async () => {
      mockSend.mockResolvedValue({
        data: { id: "msg_123" },
        error: null,
      });

      await sendEmail({ ...baseParams, replyTo: "" });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: undefined,
        }),
      );
    });
  });

  describe("attachment handling", () => {
    it("should map attachment to Resend format", async () => {
      mockSend.mockResolvedValue({
        data: { id: "msg_123" },
        error: null,
      });

      const pdfBuffer = Buffer.from("fake-pdf-content");

      await sendEmail({
        ...baseParams,
        attachment: {
          data: pdfBuffer,
          filename: "RCTI-2025-0042.pdf",
          contentType: "application/pdf",
        },
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            {
              content: pdfBuffer,
              filename: "RCTI-2025-0042.pdf",
              content_type: "application/pdf",
            },
          ],
        }),
      );
    });

    it("should pass undefined attachments when no attachment provided", async () => {
      mockSend.mockResolvedValue({
        data: { id: "msg_123" },
        error: null,
      });

      await sendEmail(baseParams);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: undefined,
        }),
      );
    });
  });

  describe("error handling", () => {
    it("should return error when Resend API returns an error object", async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { message: "Invalid API key", name: "validation_error" },
      });

      const result = await sendEmail(baseParams);

      expect(result).toEqual({
        success: false,
        error: "Resend API error: Invalid API key",
      });
    });

    it("should return error with message when send throws an Error", async () => {
      mockSend.mockRejectedValue(new Error("Network timeout"));

      const result = await sendEmail(baseParams);

      expect(result).toEqual({
        success: false,
        error: "Network timeout",
      });
    });

    it("should return generic error when send throws a non-Error", async () => {
      mockSend.mockRejectedValue("something went wrong");

      const result = await sendEmail(baseParams);

      expect(result).toEqual({
        success: false,
        error: "Failed to send email",
      });
    });

    it("should log error to console when Resend API returns error", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      mockSend.mockResolvedValue({
        data: null,
        error: { message: "Rate limit exceeded", name: "rate_limit_error" },
      });

      await sendEmail(baseParams);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Resend API error:",
        expect.objectContaining({ message: "Rate limit exceeded" }),
      );

      consoleSpy.mockRestore();
    });

    it("should log error to console when send throws", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const thrownError = new Error("Connection refused");

      mockSend.mockRejectedValue(thrownError);

      await sendEmail(baseParams);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error sending email via Resend:",
        thrownError,
      );

      consoleSpy.mockRestore();
    });

    it("should handle null data in successful response", async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await sendEmail(baseParams);

      expect(result).toEqual({
        success: true,
        messageId: undefined,
      });
    });
  });
});
