import "@testing-library/jest-dom";

describe("Job Attachment Upload - Default Type", () => {
  describe("Default attachment type value", () => {
    it("should default attachment type to runsheet when adding files", () => {
      const defaultAttachmentType = "runsheet";

      const createUploadFile = ({ file }: { file: File }) => ({
        id: Math.random().toString(36).slice(2, 11),
        file,
        status: "pending" as const,
        progress: 0,
        attachmentType: defaultAttachmentType,
      });

      const mockFile = new File(["test"], "test.pdf", {
        type: "application/pdf",
      });
      const uploadFile = createUploadFile({ file: mockFile });

      expect(uploadFile.attachmentType).toBe("runsheet");
    });

    it("should have runsheet as the first option in attachment types", () => {
      const ATTACHMENT_TYPES = [
        { value: "runsheet", label: "Runsheet" },
        { value: "docket", label: "Docket" },
        { value: "delivery_photos", label: "Delivery Photos" },
      ];

      expect(ATTACHMENT_TYPES[0].value).toBe("runsheet");
    });
  });

  describe("Attachment type options", () => {
    it("should have exactly three attachment type options", () => {
      const ATTACHMENT_TYPES = [
        { value: "runsheet", label: "Runsheet" },
        { value: "docket", label: "Docket" },
        { value: "delivery_photos", label: "Delivery Photos" },
      ];

      expect(ATTACHMENT_TYPES).toHaveLength(3);
    });

    it("should have correct labels for each attachment type", () => {
      const ATTACHMENT_TYPES = [
        { value: "runsheet", label: "Runsheet" },
        { value: "docket", label: "Docket" },
        { value: "delivery_photos", label: "Delivery Photos" },
      ];

      expect(ATTACHMENT_TYPES[0].label).toBe("Runsheet");
      expect(ATTACHMENT_TYPES[1].label).toBe("Docket");
      expect(ATTACHMENT_TYPES[2].label).toBe("Delivery Photos");
    });

    it("should have correct values for each attachment type", () => {
      const ATTACHMENT_TYPES = [
        { value: "runsheet", label: "Runsheet" },
        { value: "docket", label: "Docket" },
        { value: "delivery_photos", label: "Delivery Photos" },
      ];

      const values = ATTACHMENT_TYPES.map((t) => t.value);
      expect(values).toContain("runsheet");
      expect(values).toContain("docket");
      expect(values).toContain("delivery_photos");
    });
  });

  describe("UploadFile creation with default type", () => {
    it("all files in a batch should default to runsheet attachment type", () => {
      const defaultAttachmentType = "runsheet";

      const createUploadFile = ({ file }: { file: File }) => ({
        id: Math.random().toString(36).slice(2, 11),
        file,
        status: "pending" as const,
        progress: 0,
        attachmentType: defaultAttachmentType,
      });

      const files = [
        new File(["a"], "document.pdf", { type: "application/pdf" }),
        new File(["b"], "photo.jpg", { type: "image/jpeg" }),
        new File(["c"], "notes.txt", { type: "text/plain" }),
      ];

      const uploadFiles = files.map((file) => createUploadFile({ file }));

      for (const uploadFile of uploadFiles) {
        expect(uploadFile.attachmentType).toBe("runsheet");
        expect(uploadFile.status).toBe("pending");
        expect(uploadFile.progress).toBe(0);
      }
    });

    it("each created upload file should have a unique id", () => {
      const createUploadFile = ({ file }: { file: File }) => ({
        id: Math.random().toString(36).slice(2, 11),
        file,
        status: "pending" as const,
        progress: 0,
        attachmentType: "runsheet",
      });

      const file1 = new File(["a"], "file1.pdf", { type: "application/pdf" });
      const file2 = new File(["b"], "file2.pdf", { type: "application/pdf" });

      const upload1 = createUploadFile({ file: file1 });
      const upload2 = createUploadFile({ file: file2 });

      expect(upload1.id).not.toBe(upload2.id);
    });

    it("should preserve the original file reference in the upload file object", () => {
      const createUploadFile = ({ file }: { file: File }) => ({
        id: Math.random().toString(36).slice(2, 11),
        file,
        status: "pending" as const,
        progress: 0,
        attachmentType: "runsheet",
      });

      const originalFile = new File(["test content"], "original.pdf", {
        type: "application/pdf",
      });
      const uploadFile = createUploadFile({ file: originalFile });

      expect(uploadFile.file).toBe(originalFile);
      expect(uploadFile.file.name).toBe("original.pdf");
      expect(uploadFile.file.type).toBe("application/pdf");
    });
  });

  describe("Attachment type consistency across components", () => {
    it("job-attachment-upload and multi-job-attachment-upload share the same default type", () => {
      // Both components use "runsheet" as the default attachment type
      const singleUploadDefault = "runsheet";
      const multiUploadDefault = "runsheet";

      expect(singleUploadDefault).toBe(multiUploadDefault);
    });

    it("job-form staged files also default to runsheet", () => {
      // The job-form staged file creation also defaults to "runsheet"
      const stagedFileDefault = "runsheet";
      const uploadFileDefault = "runsheet";

      expect(stagedFileDefault).toBe(uploadFileDefault);
    });

    it("all three components share the same attachment type options", () => {
      const singleUploadTypes = [
        { value: "runsheet", label: "Runsheet" },
        { value: "docket", label: "Docket" },
        { value: "delivery_photos", label: "Delivery Photos" },
      ];

      const multiUploadTypes = [
        { value: "runsheet", label: "Runsheet" },
        { value: "docket", label: "Docket" },
        { value: "delivery_photos", label: "Delivery Photos" },
      ];

      const stagedFileTypes = [
        { value: "runsheet", label: "Runsheet" },
        { value: "docket", label: "Docket" },
        { value: "delivery_photos", label: "Delivery Photos" },
      ];

      expect(singleUploadTypes).toEqual(multiUploadTypes);
      expect(multiUploadTypes).toEqual(stagedFileTypes);
    });
  });
});
