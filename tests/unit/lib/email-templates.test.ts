/**
 * @jest-environment node
 */
import {
  buildRctiEmailHtml,
  buildRctiEmailSubjectLine,
  buildRctiEmailSubject,
} from "@/lib/email-templates";

describe("email-templates", () => {
  const baseTemplateData = {
    companyName: "Acme Transport Pty Ltd",
    companyAbn: "12 345 678 901",
    companyAddress: "123 Collins St, Melbourne VIC 3000",
    companyPhone: "(03) 9876 5432",
    companyEmail: "info@acmetransport.com.au",
    companyLogoUrl: "https://example.com/logo.png",
    invoiceNumber: "RCTI-2025-0042",
    driverName: "Bruce Wayne",
    weekEnding: "2025-06-15T00:00:00.000Z",
    total: "1234.56",
    status: "finalised",
  };

  describe("buildRctiEmailSubjectLine", () => {
    it("should build a subject line with company name and week ending", () => {
      const result = buildRctiEmailSubjectLine({
        weekEnding: "2025-06-15T00:00:00.000Z",
        companyName: "Acme Transport Pty Ltd",
      });
      expect(result).toBe("RCTI W/E 15.06.2025 from Acme Transport Pty Ltd");
    });

    it("should handle date-only ISO string", () => {
      const result = buildRctiEmailSubjectLine({
        weekEnding: "2025-01-07",
        companyName: "Test Co",
      });
      expect(result).toBe("RCTI W/E 07.01.2025 from Test Co");
    });

    it("should handle empty company name", () => {
      const result = buildRctiEmailSubjectLine({
        weekEnding: "2025-06-15T00:00:00.000Z",
        companyName: "",
      });
      expect(result).toBe("RCTI W/E 15.06.2025");
    });
  });

  describe("buildRctiEmailSubject", () => {
    it("should produce the same result as buildRctiEmailSubjectLine", () => {
      const args = {
        weekEnding: "2025-06-15T00:00:00.000Z",
        companyName: "Test Company",
      };
      const subjectLine = buildRctiEmailSubjectLine(args);
      const subject = buildRctiEmailSubject(args);
      expect(subject).toBe(subjectLine);
    });

    it("should handle whitespace-only company name", () => {
      const result = buildRctiEmailSubject({
        weekEnding: "2025-03-05T00:00:00.000Z",
        companyName: "   ",
      });
      expect(result).toBe("RCTI W/E 05.03.2025");
    });
  });

  describe("buildRctiEmailHtml", () => {
    it("should return a valid HTML document", () => {
      const html = buildRctiEmailHtml({ data: baseTemplateData });
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html lang=\"en\">");
      expect(html).toContain("</html>");
    });

    it("should include the driver name in greeting", () => {
      const html = buildRctiEmailHtml({ data: baseTemplateData });
      expect(html).toContain("Hi Bruce Wayne,");
    });

    it("should include the invoice number", () => {
      const html = buildRctiEmailHtml({ data: baseTemplateData });
      expect(html).toContain("RCTI-2025-0042");
    });

    it("should include the formatted week ending date", () => {
      const html = buildRctiEmailHtml({ data: baseTemplateData });
      expect(html).toContain("15.06.2025");
    });

    it("should include the total amount with dollar sign", () => {
      const html = buildRctiEmailHtml({ data: baseTemplateData });
      expect(html).toContain("$1234.56");
    });

    it("should include the company name in the header", () => {
      const html = buildRctiEmailHtml({ data: baseTemplateData });
      expect(html).toContain("Acme Transport Pty Ltd");
    });

    it("should include the company ABN in footer", () => {
      const html = buildRctiEmailHtml({ data: baseTemplateData });
      expect(html).toContain("ABN: 12 345 678 901");
    });

    it("should include the company address in footer", () => {
      const html = buildRctiEmailHtml({ data: baseTemplateData });
      expect(html).toContain("123 Collins St, Melbourne VIC 3000");
    });

    it("should include the company phone in footer", () => {
      const html = buildRctiEmailHtml({ data: baseTemplateData });
      expect(html).toContain("(03) 9876 5432");
    });

    it("should include the company email in footer", () => {
      const html = buildRctiEmailHtml({ data: baseTemplateData });
      expect(html).toContain("info@acmetransport.com.au");
    });

    it("should include the company logo when provided", () => {
      const html = buildRctiEmailHtml({ data: baseTemplateData });
      expect(html).toContain("<img");
      expect(html).toContain("https://example.com/logo.png");
    });

    it("should not include an img tag when companyLogoUrl is null", () => {
      const data = { ...baseTemplateData, companyLogoUrl: null };
      const html = buildRctiEmailHtml({ data });
      expect(html).not.toContain("<img");
    });

    it("should display Finalised status for finalised RCTIs", () => {
      const html = buildRctiEmailHtml({ data: baseTemplateData });
      expect(html).toContain("Finalised");
    });

    it("should display Paid status for paid RCTIs", () => {
      const data = { ...baseTemplateData, status: "paid" };
      const html = buildRctiEmailHtml({ data });
      expect(html).toContain("Paid");
    });

    it("should display raw status for unknown status values", () => {
      const data = { ...baseTemplateData, status: "custom-status" };
      const html = buildRctiEmailHtml({ data });
      expect(html).toContain("custom-status");
    });

    it("should include attachment notice text", () => {
      const html = buildRctiEmailHtml({ data: baseTemplateData });
      expect(html).toContain("attached to this email as a PDF");
    });

    it("should include reply instruction text", () => {
      const html = buildRctiEmailHtml({ data: baseTemplateData });
      expect(html).toContain("reply to this email");
    });

    it("should include the title element with invoice number", () => {
      const html = buildRctiEmailHtml({ data: baseTemplateData });
      expect(html).toContain("<title>RCTI - RCTI-2025-0042</title>");
    });

    describe("HTML escaping", () => {
      it("should escape ampersands in company name", () => {
        const data = {
          ...baseTemplateData,
          companyName: "O'Brien & Sons",
        };
        const html = buildRctiEmailHtml({ data });
        expect(html).toContain("O&#039;Brien &amp; Sons");
        expect(html).not.toMatch(/O'Brien & Sons/);
      });

      it("should escape angle brackets in driver name", () => {
        const data = {
          ...baseTemplateData,
          driverName: "<script>alert('xss')</script>",
        };
        const html = buildRctiEmailHtml({ data });
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
      });

      it("should escape double quotes in company name", () => {
        const data = {
          ...baseTemplateData,
          companyName: 'Company "Test"',
        };
        const html = buildRctiEmailHtml({ data });
        expect(html).toContain("Company &quot;Test&quot;");
      });

      it("should escape special characters in invoice number", () => {
        const data = {
          ...baseTemplateData,
          invoiceNumber: "RCTI<>2025",
        };
        const html = buildRctiEmailHtml({ data });
        expect(html).toContain("RCTI&lt;&gt;2025");
      });

      it("should escape special characters in logo URL alt text", () => {
        const data = {
          ...baseTemplateData,
          companyName: 'Test "Logo" <Company>',
          companyLogoUrl: "https://example.com/logo.png",
        };
        const html = buildRctiEmailHtml({ data });
        expect(html).toContain('alt="Test &quot;Logo&quot; &lt;Company&gt;"');
      });
    });

    describe("optional company details", () => {
      it("should omit ABN when null", () => {
        const data = { ...baseTemplateData, companyAbn: null };
        const html = buildRctiEmailHtml({ data });
        expect(html).not.toContain("ABN:");
      });

      it("should omit address when null", () => {
        const data = { ...baseTemplateData, companyAddress: null };
        const html = buildRctiEmailHtml({ data });
        expect(html).not.toContain("123 Collins St");
      });

      it("should omit phone when null", () => {
        const data = { ...baseTemplateData, companyPhone: null };
        const html = buildRctiEmailHtml({ data });
        expect(html).not.toContain("(03) 9876 5432");
      });

      it("should omit email when null", () => {
        const data = { ...baseTemplateData, companyEmail: null };
        const html = buildRctiEmailHtml({ data });
        expect(html).not.toContain("info@acmetransport.com.au");
      });

      it("should not render company details paragraph when all optional fields are null", () => {
        const data = {
          ...baseTemplateData,
          companyAbn: null,
          companyAddress: null,
          companyPhone: null,
          companyEmail: null,
        };
        const html = buildRctiEmailHtml({ data });
        expect(html).not.toContain("color:#6b7280;line-height:1.6;\">");
      });
    });

    describe("email header styling", () => {
      it("should use white background for header", () => {
        const html = buildRctiEmailHtml({ data: baseTemplateData });
        expect(html).toContain("background-color:#ffffff;padding:24px 32px;text-align:center;border-bottom:2px solid #e5e7eb;");
      });

      it("should use dark blue text for company name in header", () => {
        const html = buildRctiEmailHtml({ data: baseTemplateData });
        expect(html).toContain("color:#1e3a5f;");
      });
    });

    describe("email body structure", () => {
      it("should include a grey background on the outer table", () => {
        const html = buildRctiEmailHtml({ data: baseTemplateData });
        expect(html).toContain("background-color:#f3f4f6");
      });

      it("should include a white card for the main content", () => {
        const html = buildRctiEmailHtml({ data: baseTemplateData });
        expect(html).toContain("background-color:#ffffff;border-radius:8px");
      });

      it("should include the RCTI details table", () => {
        const html = buildRctiEmailHtml({ data: baseTemplateData });
        expect(html).toContain("Invoice Number");
        expect(html).toContain("Week Ending");
        expect(html).toContain("Status");
        expect(html).toContain("Total");
      });

      it("should include the automated email notice in footer", () => {
        const html = buildRctiEmailHtml({ data: baseTemplateData });
        expect(html).toContain("This is an automated email");
      });
    });

    describe("week ending mention in body text", () => {
      it("should mention the week ending in the body paragraph", () => {
        const html = buildRctiEmailHtml({ data: baseTemplateData });
        expect(html).toContain(
          "for the week ending <strong>15.06.2025</strong>",
        );
      });
    });
  });
});
