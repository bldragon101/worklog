import {
  extractFileIdFromUrl,
  extractFilenameFromUrl,
  extractAttachmentTypeFromFilename,
  extractVersionFromFilename,
  generateAttachmentFilename,
  updateFilenameInUrl,
  generateCustomerFolderName,
} from "@/lib/attachment-utils";

describe("Attachment Sync Utilities", () => {
  describe("extractFileIdFromUrl", () => {
    it("extracts file ID from valid Google Drive URL", () => {
      const url =
        "https://drive.google.com/file/d/1abc123XYZ-def456/view?filename=test.pdf";
      expect(extractFileIdFromUrl(url)).toBe("1abc123XYZ-def456");
    });

    it("returns null for invalid URL", () => {
      const url = "https://example.com/some-file.pdf";
      expect(extractFileIdFromUrl(url)).toBeNull();
    });

    it("handles URL without query parameters", () => {
      const url = "https://drive.google.com/file/d/abcdef123456/view";
      expect(extractFileIdFromUrl(url)).toBe("abcdef123456");
    });

    it("returns null for empty string", () => {
      expect(extractFileIdFromUrl("")).toBeNull();
    });
  });

  describe("extractFilenameFromUrl", () => {
    it("extracts filename from URL query parameter", () => {
      const url =
        "https://drive.google.com/file/d/123/view?filename=01.01.25_John_Acme_Truck_runsheet.pdf";
      expect(extractFilenameFromUrl(url)).toBe(
        "01.01.25_John_Acme_Truck_runsheet.pdf",
      );
    });

    it("decodes URL-encoded filename", () => {
      const url =
        "https://drive.google.com/file/d/123/view?filename=01.01.25_John%20Doe_Acme%20Corp_Truck_runsheet.pdf";
      expect(extractFilenameFromUrl(url)).toBe(
        "01.01.25_John Doe_Acme Corp_Truck_runsheet.pdf",
      );
    });

    it("returns null when no filename parameter", () => {
      const url = "https://drive.google.com/file/d/123/view";
      expect(extractFilenameFromUrl(url)).toBeNull();
    });

    it("returns null for invalid URL", () => {
      expect(extractFilenameFromUrl("not-a-url")).toBeNull();
    });
  });

  describe("extractAttachmentTypeFromFilename", () => {
    it("extracts runsheet type", () => {
      expect(
        extractAttachmentTypeFromFilename(
          "01.01.25_John_Acme_Truck_runsheet.pdf",
        ),
      ).toBe("runsheet");
    });

    it("extracts docket type", () => {
      expect(
        extractAttachmentTypeFromFilename(
          "01.01.25_John_Acme_Truck_docket.pdf",
        ),
      ).toBe("docket");
    });

    it("extracts delivery_photos type", () => {
      expect(
        extractAttachmentTypeFromFilename(
          "01.01.25_John_Acme_Truck_delivery_photos.jpg",
        ),
      ).toBe("delivery_photos");
    });

    it("returns null for unknown type", () => {
      expect(
        extractAttachmentTypeFromFilename("01.01.25_John_Acme_Truck_other.pdf"),
      ).toBeNull();
    });

    it("handles versioned filenames", () => {
      expect(
        extractAttachmentTypeFromFilename(
          "01.01.25_John_Acme_Truck_runsheet_2.pdf",
        ),
      ).toBe("runsheet");
    });
  });

  describe("extractVersionFromFilename", () => {
    it("returns 0 for filename without version", () => {
      expect(
        extractVersionFromFilename("01.01.25_John_Acme_Truck_runsheet.pdf"),
      ).toBe(0);
    });

    it("extracts version number from filename", () => {
      expect(
        extractVersionFromFilename("01.01.25_John_Acme_Truck_runsheet_2.pdf"),
      ).toBe(2);
    });

    it("handles higher version numbers", () => {
      expect(
        extractVersionFromFilename("01.01.25_John_Acme_Truck_docket_15.pdf"),
      ).toBe(15);
    });

    it("returns 0 for non-standard filename", () => {
      expect(extractVersionFromFilename("random_file.pdf")).toBe(0);
    });
  });

  describe("generateAttachmentFilename", () => {
    const baseJob = {
      date: new Date("2025-01-15"),
      driver: "John Smith",
      customer: "Acme Corp",
      truckType: "Semi",
    };

    it("generates filename with correct format", () => {
      const result = generateAttachmentFilename({
        job: baseJob,
        attachmentType: "runsheet",
        extension: "pdf",
        version: 0,
      });

      expect(result).toBe("15.01.25_John Smith_Acme Corp_Semi_runsheet.pdf");
    });

    it("adds version suffix when version > 0", () => {
      const result = generateAttachmentFilename({
        job: baseJob,
        attachmentType: "docket",
        extension: "pdf",
        version: 3,
      });

      expect(result).toBe("15.01.25_John Smith_Acme Corp_Semi_docket_3.pdf");
    });

    it("handles null driver", () => {
      const result = generateAttachmentFilename({
        job: { ...baseJob, driver: null },
        attachmentType: "runsheet",
        extension: "pdf",
        version: 0,
      });

      expect(result).toBe("15.01.25_Unknown_Acme Corp_Semi_runsheet.pdf");
    });

    it("handles null truckType", () => {
      const result = generateAttachmentFilename({
        job: { ...baseJob, truckType: null },
        attachmentType: "runsheet",
        extension: "pdf",
        version: 0,
      });

      expect(result).toBe("15.01.25_John Smith_Acme Corp_Unknown_runsheet.pdf");
    });

    it("handles date as string", () => {
      const result = generateAttachmentFilename({
        job: { ...baseJob, date: "2025-01-15T00:00:00.000Z" },
        attachmentType: "runsheet",
        extension: "pdf",
        version: 0,
      });

      expect(result).toBe("15.01.25_John Smith_Acme Corp_Semi_runsheet.pdf");
    });

    it("handles delivery_photos type", () => {
      const result = generateAttachmentFilename({
        job: baseJob,
        attachmentType: "delivery_photos",
        extension: "jpg",
        version: 0,
      });

      expect(result).toBe(
        "15.01.25_John Smith_Acme Corp_Semi_delivery_photos.jpg",
      );
    });

    it("parses ISO date string without timezone conversion", () => {
      // This ISO string represents midnight UTC on Jan 15
      // Without proper handling, this could become Jan 14 in negative UTC offsets
      const result = generateAttachmentFilename({
        job: {
          ...baseJob,
          date: "2025-01-15T00:00:00.000Z",
        },
        attachmentType: "runsheet",
        extension: "pdf",
        version: 0,
      });

      // Should always be 15.01.25 regardless of local timezone
      expect(result).toBe("15.01.25_John Smith_Acme Corp_Semi_runsheet.pdf");
    });

    it("parses YYYY-MM-DD date string without timezone conversion", () => {
      const result = generateAttachmentFilename({
        job: {
          ...baseJob,
          date: "2025-01-15",
        },
        attachmentType: "runsheet",
        extension: "pdf",
        version: 0,
      });

      expect(result).toBe("15.01.25_John Smith_Acme Corp_Semi_runsheet.pdf");
    });

    it("handles Date object as-is", () => {
      const result = generateAttachmentFilename({
        job: {
          ...baseJob,
          date: new Date(2025, 0, 15), // Jan 15, 2025 (month is 0-indexed)
        },
        attachmentType: "runsheet",
        extension: "pdf",
        version: 0,
      });

      expect(result).toBe("15.01.25_John Smith_Acme Corp_Semi_runsheet.pdf");
    });
  });

  describe("updateFilenameInUrl", () => {
    it("updates existing filename parameter", () => {
      const url =
        "https://drive.google.com/file/d/123/view?filename=old_name.pdf";
      const result = updateFilenameInUrl(url, "new_name.pdf");

      expect(result).toContain("filename=new_name.pdf");
      expect(result).toContain("https://drive.google.com/file/d/123/view");
    });

    it("adds filename parameter when not present", () => {
      const url = "https://drive.google.com/file/d/123/view";
      const result = updateFilenameInUrl(url, "new_name.pdf");

      expect(result).toContain("filename=new_name.pdf");
    });

    it("encodes special characters in filename", () => {
      const url = "https://drive.google.com/file/d/123/view";
      const result = updateFilenameInUrl(url, "file with spaces.pdf");

      expect(result).toContain("filename=file+with+spaces.pdf");
    });

    it("handles malformed URL gracefully", () => {
      const url = "not-a-valid-url";
      const result = updateFilenameInUrl(url, "test.pdf");

      expect(result).toContain("test.pdf");
    });
  });

  describe("Integration scenarios", () => {
    it("full workflow: extract, generate new name, update URL", () => {
      const originalUrl =
        "https://drive.google.com/file/d/abc123/view?filename=01.01.25_Old_Driver_Old_Customer_Old_Truck_runsheet.pdf";

      const fileId = extractFileIdFromUrl(originalUrl);
      expect(fileId).toBe("abc123");

      const currentFilename = extractFilenameFromUrl(originalUrl);
      expect(currentFilename).toBe(
        "01.01.25_Old_Driver_Old_Customer_Old_Truck_runsheet.pdf",
      );

      const attachmentType = extractAttachmentTypeFromFilename(
        currentFilename!,
      );
      expect(attachmentType).toBe("runsheet");

      const version = extractVersionFromFilename(currentFilename!);
      expect(version).toBe(0);

      const newFilename = generateAttachmentFilename({
        job: {
          date: new Date("2025-01-01"),
          driver: "New Driver",
          customer: "New Customer",
          truckType: "New Truck",
        },
        attachmentType: attachmentType!,
        extension: "pdf",
        version,
      });
      expect(newFilename).toBe(
        "01.01.25_New Driver_New Customer_New Truck_runsheet.pdf",
      );

      const updatedUrl = updateFilenameInUrl(originalUrl, newFilename);
      expect(updatedUrl).toContain(
        "filename=01.01.25_New+Driver_New+Customer_New+Truck_runsheet.pdf",
      );
      expect(updatedUrl).toContain("abc123");
    });

    it("handles versioned file workflow", () => {
      const originalUrl =
        "https://drive.google.com/file/d/xyz789/view?filename=15.03.25_Driver_Customer_Truck_docket_2.pdf";

      const currentFilename = extractFilenameFromUrl(originalUrl);
      const attachmentType = extractAttachmentTypeFromFilename(
        currentFilename!,
      );
      const version = extractVersionFromFilename(currentFilename!);

      expect(attachmentType).toBe("docket");
      expect(version).toBe(2);

      const newFilename = generateAttachmentFilename({
        job: {
          date: new Date("2025-03-15"),
          driver: "Updated Driver",
          customer: "Updated Customer",
          truckType: "Updated Truck",
        },
        attachmentType: attachmentType!,
        extension: "pdf",
        version,
      });

      expect(newFilename).toBe(
        "15.03.25_Updated Driver_Updated Customer_Updated Truck_docket_2.pdf",
      );
    });

    it("skips sync when filename already matches", () => {
      const job = {
        date: new Date("2025-01-15"),
        driver: "John Smith",
        customer: "Acme Corp",
        truckType: "Semi",
      };

      const expectedFilename =
        "15.01.25_John Smith_Acme Corp_Semi_runsheet.pdf";
      const url = `https://drive.google.com/file/d/123/view?filename=${encodeURIComponent(expectedFilename)}`;

      const currentFilename = extractFilenameFromUrl(url);
      const attachmentType = extractAttachmentTypeFromFilename(
        currentFilename!,
      );
      const version = extractVersionFromFilename(currentFilename!);

      const newFilename = generateAttachmentFilename({
        job,
        attachmentType: attachmentType!,
        extension: "pdf",
        version,
      });

      expect(currentFilename).toBe(newFilename);
    });
  });

  describe("generateCustomerFolderName", () => {
    it("returns just customer name when customer equals billTo", () => {
      expect(generateCustomerFolderName("Acme Corp", "Acme Corp")).toBe(
        "Acme Corp",
      );
    });

    it("combines customer and billTo when different", () => {
      expect(generateCustomerFolderName("Acme Corp", "Parent Company")).toBe(
        "Acme Corp_Parent Company",
      );
    });

    it("handles special characters in names", () => {
      const result = generateCustomerFolderName(
        "Customer/Name",
        "Bill:To<Name>",
      );
      expect(result).not.toContain("/");
      expect(result).not.toContain(":");
      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
    });

    it("handles empty-ish billTo that sanitises to same as customer", () => {
      const result = generateCustomerFolderName("Customer", "Customer");
      expect(result).toBe("Customer");
    });
  });

  describe("Folder move scenarios", () => {
    it("determines correct folder name when customer changes", () => {
      const oldFolder = generateCustomerFolderName(
        "Old Customer",
        "Old Customer",
      );
      const newFolder = generateCustomerFolderName(
        "New Customer",
        "New Customer",
      );

      expect(oldFolder).toBe("Old Customer");
      expect(newFolder).toBe("New Customer");
      expect(oldFolder).not.toBe(newFolder);
    });

    it("determines correct folder name when billTo changes", () => {
      const oldFolder = generateCustomerFolderName("Customer", "Old BillTo");
      const newFolder = generateCustomerFolderName("Customer", "New BillTo");

      expect(oldFolder).toBe("Customer_Old BillTo");
      expect(newFolder).toBe("Customer_New BillTo");
      expect(oldFolder).not.toBe(newFolder);
    });

    it("determines folder stays same when only driver changes", () => {
      const folder1 = generateCustomerFolderName("Customer", "BillTo");
      const folder2 = generateCustomerFolderName("Customer", "BillTo");

      expect(folder1).toBe(folder2);
    });
  });
});
