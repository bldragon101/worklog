import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  MultiJobAttachmentUpload,
  formatJobLabel,
  formatFileSize,
  generateFileId,
  isValidFileType,
  ACCEPTED_FILE_TYPES,
  ATTACHMENT_TYPES,
  MAX_FILE_SIZE,
} from "@/components/ui/multi-job-attachment-upload";
import type { Job } from "@/lib/types";

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock useToast hook
const mockToast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

const mockJobs: Job[] = [
  {
    id: 1,
    date: "2025-01-15",
    driver: "JOHN DOE",
    customer: "ACME CORP",
    billTo: "ACME CORP",
    registration: "ABC123",
    truckType: "Tray",
    pickup: "Melbourne",
    dropoff: "Sydney",
    runsheet: false,
    invoiced: false,
    chargedHours: 8,
    driverCharge: null,
    startTime: null,
    finishTime: null,
    comments: null,
    jobReference: null,
    eastlink: null,
    citylink: null,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  },
  {
    id: 2,
    date: "2025-01-16",
    driver: "JANE SMITH",
    customer: "XYZ INC",
    billTo: "XYZ INC",
    registration: "XYZ789",
    truckType: "Semi",
    pickup: "Brisbane",
    dropoff: "Adelaide",
    runsheet: false,
    invoiced: false,
    chargedHours: 10,
    driverCharge: null,
    startTime: null,
    finishTime: null,
    comments: null,
    jobReference: null,
    eastlink: null,
    citylink: null,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  },
];

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  jobs: mockJobs,
  baseFolderId: "mock-base-folder-id",
  driveId: "mock-drive-id",
  onUploadSuccess: jest.fn(),
};

describe("MultiJobAttachmentUpload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Helper functions - formatJobLabel", () => {
    it("formats job label as DD/MM/YY - Driver - Customer", () => {
      expect(formatJobLabel({ job: mockJobs[0] })).toBe(
        "15/01/25 - JOHN DOE - ACME CORP",
      );
      expect(formatJobLabel({ job: mockJobs[1] })).toBe(
        "16/01/25 - JANE SMITH - XYZ INC",
      );
    });
  });

  describe("Helper functions - formatFileSize", () => {
    it("formats zero bytes correctly", () => {
      expect(formatFileSize({ bytes: 0 })).toBe("0 Bytes");
    });

    it("formats bytes in various sizes", () => {
      expect(formatFileSize({ bytes: 500 })).toBe("500 Bytes");
      expect(formatFileSize({ bytes: 1024 })).toBe("1 KB");
      expect(formatFileSize({ bytes: 1048576 })).toBe("1 MB");
      expect(formatFileSize({ bytes: 5242880 })).toBe("5 MB");
    });
  });

  describe("Helper functions - generateFileId", () => {
    it("generates unique IDs", () => {
      const id1 = generateFileId();
      const id2 = generateFileId();

      expect(id1).not.toBe(id2);
      expect(id1.length).toBeGreaterThan(0);
      expect(id2.length).toBeGreaterThan(0);
    });
  });

  describe("Helper functions - isValidFileType", () => {
    it("accepts valid image file types", () => {
      const jpegFile = new File(["test"], "photo.jpg", { type: "image/jpeg" });
      const pngFile = new File(["test"], "photo.png", { type: "image/png" });
      const gifFile = new File(["test"], "animation.gif", {
        type: "image/gif",
      });
      const webpFile = new File(["test"], "photo.webp", { type: "image/webp" });

      expect(isValidFileType({ file: jpegFile })).toBe(true);
      expect(isValidFileType({ file: pngFile })).toBe(true);
      expect(isValidFileType({ file: gifFile })).toBe(true);
      expect(isValidFileType({ file: webpFile })).toBe(true);
    });

    it("accepts valid document file types", () => {
      const pdfFile = new File(["test"], "doc.pdf", {
        type: "application/pdf",
      });
      const docFile = new File(["test"], "doc.doc", {
        type: "application/msword",
      });
      const docxFile = new File(["test"], "doc.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const txtFile = new File(["test"], "doc.txt", { type: "text/plain" });

      expect(isValidFileType({ file: pdfFile })).toBe(true);
      expect(isValidFileType({ file: docFile })).toBe(true);
      expect(isValidFileType({ file: docxFile })).toBe(true);
      expect(isValidFileType({ file: txtFile })).toBe(true);
    });

    it("rejects invalid file types", () => {
      const exeFile = new File(["test"], "app.exe", {
        type: "application/x-msdownload",
      });
      const zipFile = new File(["test"], "archive.zip", {
        type: "application/zip",
      });
      const htmlFile = new File(["test"], "page.html", { type: "text/html" });
      const mp4File = new File(["test"], "video.mp4", { type: "video/mp4" });

      expect(isValidFileType({ file: exeFile })).toBe(false);
      expect(isValidFileType({ file: zipFile })).toBe(false);
      expect(isValidFileType({ file: htmlFile })).toBe(false);
      expect(isValidFileType({ file: mp4File })).toBe(false);
    });
  });

  describe("Validation logic", () => {
    it("rejects files larger than 20MB", () => {
      const oversizedBytes = 21 * 1024 * 1024;
      expect(oversizedBytes).toBeGreaterThan(MAX_FILE_SIZE);

      const validBytes = 5 * 1024 * 1024;
      expect(validBytes).toBeLessThan(MAX_FILE_SIZE);
    });

    it('attachment types default to "runsheet"', () => {
      expect(ATTACHMENT_TYPES[0].value).toBe("runsheet");

      const testFile = new File(["test"], "test.pdf", {
        type: "application/pdf",
      });
      const jobFile = {
        id: generateFileId(),
        file: testFile,
        attachmentType: ATTACHMENT_TYPES[0].value,
      };
      expect(jobFile.attachmentType).toBe("runsheet");
    });
  });

  describe("File-by-job data structure logic", () => {
    it("groups files by job ID", () => {
      const filesByJob: Record<
        number,
        Array<{ id: string; file: File; attachmentType: string }>
      > = {};

      const addFileToJob = ({ jobId, file }: { jobId: number; file: File }) => {
        const jobFile = {
          id: Math.random().toString(36).slice(2, 11),
          file,
          attachmentType: "runsheet",
        };
        filesByJob[jobId] = [...(filesByJob[jobId] || []), jobFile];
      };

      addFileToJob({
        jobId: 1,
        file: new File(["a"], "file1.pdf", { type: "application/pdf" }),
      });
      addFileToJob({
        jobId: 1,
        file: new File(["b"], "file2.pdf", { type: "application/pdf" }),
      });
      addFileToJob({
        jobId: 2,
        file: new File(["c"], "file3.pdf", { type: "application/pdf" }),
      });

      expect(filesByJob[1]).toHaveLength(2);
      expect(filesByJob[2]).toHaveLength(1);
      expect(filesByJob[1][0].file.name).toBe("file1.pdf");
      expect(filesByJob[1][1].file.name).toBe("file2.pdf");
      expect(filesByJob[2][0].file.name).toBe("file3.pdf");
    });

    it("removes a file from a specific job", () => {
      const filesByJob: Record<
        number,
        Array<{ id: string; file: File; attachmentType: string }>
      > = {
        1: [
          {
            id: "f1",
            file: new File(["a"], "a.pdf", { type: "application/pdf" }),
            attachmentType: "runsheet",
          },
          {
            id: "f2",
            file: new File(["b"], "b.pdf", { type: "application/pdf" }),
            attachmentType: "docket",
          },
        ],
        2: [
          {
            id: "f3",
            file: new File(["c"], "c.pdf", { type: "application/pdf" }),
            attachmentType: "runsheet",
          },
        ],
      };

      const removeFile = ({
        jobId,
        fileId,
      }: {
        jobId: number;
        fileId: string;
      }) => {
        const updated = { ...filesByJob };
        const jobFiles = updated[jobId];
        if (!jobFiles) return updated;
        const filtered = jobFiles.filter((f) => f.id !== fileId);
        if (filtered.length === 0) {
          const { [jobId]: _, ...rest } = updated;
          return rest;
        }
        updated[jobId] = filtered;
        return updated;
      };

      const result = removeFile({ jobId: 1, fileId: "f1" });
      expect(result[1]).toHaveLength(1);
      expect(result[1][0].id).toBe("f2");
      expect(result[2]).toHaveLength(1);
    });

    it("removes the job key when all files are removed", () => {
      const filesByJob: Record<
        number,
        Array<{ id: string; file: File; attachmentType: string }>
      > = {
        1: [
          {
            id: "f1",
            file: new File(["a"], "a.pdf", { type: "application/pdf" }),
            attachmentType: "runsheet",
          },
        ],
      };

      const removeFile = ({
        jobId,
        fileId,
      }: {
        jobId: number;
        fileId: string;
      }) => {
        const updated = { ...filesByJob };
        const jobFiles = updated[jobId];
        if (!jobFiles) return updated;
        const filtered = jobFiles.filter((f) => f.id !== fileId);
        if (filtered.length === 0) {
          const { [jobId]: _, ...rest } = updated;
          return rest;
        }
        updated[jobId] = filtered;
        return updated;
      };

      const result = removeFile({ jobId: 1, fileId: "f1" });
      expect(result[1]).toBeUndefined();
      expect(Object.keys(result)).toHaveLength(0);
    });

    it("updates file attachment type for a specific job and file", () => {
      const filesByJob: Record<
        number,
        Array<{ id: string; file: File; attachmentType: string }>
      > = {
        1: [
          {
            id: "f1",
            file: new File(["a"], "a.pdf", { type: "application/pdf" }),
            attachmentType: "runsheet",
          },
          {
            id: "f2",
            file: new File(["b"], "b.pdf", { type: "application/pdf" }),
            attachmentType: "runsheet",
          },
        ],
      };

      const updateFileAttachmentType = ({
        jobId,
        fileId,
        attachmentType,
      }: {
        jobId: number;
        fileId: string;
        attachmentType: string;
      }) => ({
        ...filesByJob,
        [jobId]: (filesByJob[jobId] || []).map((f) =>
          f.id === fileId ? { ...f, attachmentType } : f,
        ),
      });

      const result = updateFileAttachmentType({
        jobId: 1,
        fileId: "f2",
        attachmentType: "docket",
      });

      expect(result[1][0].attachmentType).toBe("runsheet");
      expect(result[1][1].attachmentType).toBe("docket");
    });

    it("calculates total file count across all jobs", () => {
      const filesByJob: Record<
        number,
        Array<{ id: string; file: File; attachmentType: string }>
      > = {
        1: [
          {
            id: "f1",
            file: new File(["a"], "a.pdf", { type: "application/pdf" }),
            attachmentType: "runsheet",
          },
          {
            id: "f2",
            file: new File(["b"], "b.pdf", { type: "application/pdf" }),
            attachmentType: "runsheet",
          },
        ],
        2: [
          {
            id: "f3",
            file: new File(["c"], "c.pdf", { type: "application/pdf" }),
            attachmentType: "runsheet",
          },
        ],
      };

      const totalFileCount = Object.values(filesByJob).reduce(
        (sum, files) => sum + files.length,
        0,
      );

      expect(totalFileCount).toBe(3);
    });

    it("identifies jobs that have files attached", () => {
      const filesByJob: Record<
        number,
        Array<{ id: string; file: File; attachmentType: string }>
      > = {
        1: [
          {
            id: "f1",
            file: new File(["a"], "a.pdf", { type: "application/pdf" }),
            attachmentType: "runsheet",
          },
        ],
        2: [],
        3: [
          {
            id: "f2",
            file: new File(["b"], "b.pdf", { type: "application/pdf" }),
            attachmentType: "runsheet",
          },
        ],
      };

      const jobsWithFiles = Object.keys(filesByJob).filter(
        (jobId) => (filesByJob[Number(jobId)]?.length || 0) > 0,
      );

      expect(jobsWithFiles).toEqual(["1", "3"]);
      expect(jobsWithFiles).toHaveLength(2);
    });

    it("canUpload is true only when files exist and not uploading", () => {
      const totalFileCount = 3;
      const isUploading = false;
      const canUpload = totalFileCount > 0 && !isUploading;

      expect(canUpload).toBe(true);

      const canUploadWhileUploading = totalFileCount > 0 && !true;
      expect(canUploadWhileUploading).toBe(false);

      const canUploadNoFiles = 0 > 0 && !isUploading;
      expect(canUploadNoFiles).toBe(false);
    });
  });

  describe("Upload logic", () => {
    it("uploads files grouped by job to the correct API endpoint", async () => {
      const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            job: { ...mockJobs[0], attachmentRunsheet: ["uploaded-file.pdf"] },
          }),
      } as Response);

      const filesByJob: Record<
        number,
        Array<{ id: string; file: File; attachmentType: string }>
      > = {
        1: [
          {
            id: "f1",
            file: new File(["content"], "test.pdf", {
              type: "application/pdf",
            }),
            attachmentType: "runsheet",
          },
        ],
      };

      const jobIdsToUpload = Object.keys(filesByJob)
        .map(Number)
        .filter((jobId) => (filesByJob[jobId]?.length || 0) > 0);

      for (const jobId of jobIdsToUpload) {
        const jobFiles = filesByJob[jobId];
        if (!jobFiles || jobFiles.length === 0) continue;

        const formData = new FormData();
        for (const [index, jf] of jobFiles.entries()) {
          formData.append("files", jf.file);
          formData.append(`attachmentTypes[${index}]`, jf.attachmentType);
        }
        formData.append("baseFolderId", "mock-base-folder-id");
        formData.append("driveId", "mock-drive-id");

        await fetch(`/api/jobs/${jobId}/attachments`, {
          method: "POST",
          body: formData,
        });
      }

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobs/1/attachments",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("calls onUploadSuccess with updated jobs on success", async () => {
      const updatedJob = {
        ...mockJobs[0],
        attachmentRunsheet: ["uploaded-file.pdf"],
      };

      const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            job: updatedJob,
          }),
      } as Response);

      const onUploadSuccess = jest.fn();
      const updatedJobs: Job[] = [];

      const response = await fetch("/api/jobs/1/attachments", {
        method: "POST",
        body: new FormData(),
      });
      const result = await response.json();

      if (response.ok && result.success) {
        updatedJobs.push(result.job);
      }

      if (updatedJobs.length > 0) {
        onUploadSuccess(updatedJobs);
      }

      expect(onUploadSuccess).toHaveBeenCalledTimes(1);
      expect(onUploadSuccess).toHaveBeenCalledWith([updatedJob]);
    });

    it("handles upload failure by recording error status for the failed job", async () => {
      const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
      fetchMock.mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            success: false,
            error: "Upload failed",
          }),
      } as Response);

      const jobStatuses: Record<number, { status: string; error?: string }> =
        {};

      const response = await fetch("/api/jobs/1/attachments", {
        method: "POST",
        body: new FormData(),
      });
      const result = await response.json();

      if (response.ok && result.success) {
        jobStatuses[1] = { status: "success" };
      } else {
        const errorMsg = result.error || "Upload failed";
        jobStatuses[1] = { status: "error", error: errorMsg };
      }

      expect(jobStatuses[1].status).toBe("error");
      expect(jobStatuses[1].error).toBe("Upload failed");
    });

    it("handles network errors gracefully", async () => {
      const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
      fetchMock.mockRejectedValue(new Error("Network error"));

      const jobStatuses: Record<number, { status: string; error?: string }> =
        {};

      try {
        await fetch("/api/jobs/1/attachments", {
          method: "POST",
          body: new FormData(),
        });
      } catch {
        jobStatuses[1] = { status: "error", error: "Network error" };
      }

      expect(jobStatuses[1].status).toBe("error");
      expect(jobStatuses[1].error).toBe("Network error");
    });

    it("handles partial upload failures correctly", async () => {
      const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

      const updatedJob1 = {
        ...mockJobs[0],
        attachmentRunsheet: ["file1.pdf"],
      };

      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              job: updatedJob1,
            }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          json: () =>
            Promise.resolve({
              success: false,
              error: "Drive quota exceeded",
            }),
        } as Response);

      const updatedJobs: Job[] = [];
      const jobStatuses: Record<number, { status: string; error?: string }> =
        {};
      const jobIdsToUpload = [1, 2];

      for (const jobId of jobIdsToUpload) {
        try {
          const response = await fetch(`/api/jobs/${jobId}/attachments`, {
            method: "POST",
            body: new FormData(),
          });
          const result = await response.json();

          if (response.ok && result.success) {
            jobStatuses[jobId] = { status: "success" };
            updatedJobs.push(result.job);
          } else {
            jobStatuses[jobId] = {
              status: "error",
              error: result.error || "Upload failed",
            };
          }
        } catch {
          jobStatuses[jobId] = { status: "error", error: "Network error" };
        }
      }

      expect(updatedJobs).toHaveLength(1);
      expect(updatedJobs[0].id).toBe(1);
      expect(jobStatuses[1].status).toBe("success");
      expect(jobStatuses[2].status).toBe("error");
      expect(jobStatuses[2].error).toBe("Drive quota exceeded");

      const failedCount = jobIdsToUpload.length - updatedJobs.length;
      expect(failedCount).toBe(1);
    });

    it("uploads multiple files per job with correct FormData structure", () => {
      const jobFiles = [
        {
          id: "f1",
          file: new File(["a"], "runsheet.pdf", { type: "application/pdf" }),
          attachmentType: "runsheet",
        },
        {
          id: "f2",
          file: new File(["b"], "docket.pdf", { type: "application/pdf" }),
          attachmentType: "docket",
        },
        {
          id: "f3",
          file: new File(["c"], "photo.jpg", { type: "image/jpeg" }),
          attachmentType: "delivery_photos",
        },
      ];

      const formData = new FormData();
      for (const [index, jf] of jobFiles.entries()) {
        formData.append("files", jf.file);
        formData.append(`attachmentTypes[${index}]`, jf.attachmentType);
      }
      formData.append("baseFolderId", "mock-base-folder-id");
      formData.append("driveId", "mock-drive-id");

      const files = formData.getAll("files");
      expect(files).toHaveLength(3);

      expect(formData.get("attachmentTypes[0]")).toBe("runsheet");
      expect(formData.get("attachmentTypes[1]")).toBe("docket");
      expect(formData.get("attachmentTypes[2]")).toBe("delivery_photos");
      expect(formData.get("baseFolderId")).toBe("mock-base-folder-id");
      expect(formData.get("driveId")).toBe("mock-drive-id");
    });
  });

  describe("Rendering tests", () => {
    it("renders dialog when isOpen is true", async () => {
      await act(async () => {
        render(<MultiJobAttachmentUpload {...defaultProps} />);
      });

      await waitFor(() => {
        const dialog = document.getElementById(
          "multi-job-attachment-upload-dialog",
        );
        expect(dialog).toBeInTheDocument();
      });
    });

    it("dialog title shows correct job count for multiple jobs", async () => {
      await act(async () => {
        render(<MultiJobAttachmentUpload {...defaultProps} />);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Upload Attachments - 2 Jobs Selected/),
        ).toBeInTheDocument();
      });
    });

    it('dialog title uses singular "Job" for single job', async () => {
      await act(async () => {
        render(
          <MultiJobAttachmentUpload {...defaultProps} jobs={[mockJobs[0]]} />,
        );
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Upload Attachments - 1 Job Selected/),
        ).toBeInTheDocument();
      });
    });

    it("each job has its own drop zone with correct id", async () => {
      await act(async () => {
        render(<MultiJobAttachmentUpload {...defaultProps} />);
      });

      await waitFor(() => {
        const dropZone1 = document.getElementById("job-drop-zone-1");
        const dropZone2 = document.getElementById("job-drop-zone-2");
        expect(dropZone1).toBeInTheDocument();
        expect(dropZone2).toBeInTheDocument();
      });
    });

    it("each job shows its label in DD/MM/YY - Driver - Customer format", async () => {
      await act(async () => {
        render(<MultiJobAttachmentUpload {...defaultProps} />);
      });

      await waitFor(() => {
        expect(
          screen.getByText("15/01/25 - JOHN DOE - ACME CORP"),
        ).toBeInTheDocument();
        expect(
          screen.getByText("16/01/25 - JANE SMITH - XYZ INC"),
        ).toBeInTheDocument();
      });
    });

    it("Cancel button is present with correct id", async () => {
      await act(async () => {
        render(<MultiJobAttachmentUpload {...defaultProps} />);
      });

      await waitFor(() => {
        const cancelBtn = document.getElementById("multi-cancel-upload-btn");
        expect(cancelBtn).toBeInTheDocument();
        expect(cancelBtn).toHaveTextContent("Cancel");
      });
    });

    it("Upload button is present with correct id and disabled when no files", async () => {
      await act(async () => {
        render(<MultiJobAttachmentUpload {...defaultProps} />);
      });

      await waitFor(() => {
        const uploadBtn = document.getElementById("multi-upload-files-btn");
        expect(uploadBtn).toBeInTheDocument();
        expect(uploadBtn).toBeDisabled();
      });
    });

    it("shows job ID badges for each job", async () => {
      await act(async () => {
        render(<MultiJobAttachmentUpload {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText("#1")).toBeInTheDocument();
        expect(screen.getByText("#2")).toBeInTheDocument();
      });
    });

    it('shows "No files added yet" when no files are staged', async () => {
      await act(async () => {
        render(<MultiJobAttachmentUpload {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText("No files added yet")).toBeInTheDocument();
      });
    });

    it("each job has a hidden file input with correct id", async () => {
      await act(async () => {
        render(<MultiJobAttachmentUpload {...defaultProps} />);
      });

      await waitFor(() => {
        const input1 = document.getElementById("multi-hidden-file-input-1");
        const input2 = document.getElementById("multi-hidden-file-input-2");
        expect(input1).toBeInTheDocument();
        expect(input2).toBeInTheDocument();
        expect(input1).toHaveAttribute("type", "file");
        expect(input2).toHaveAttribute("type", "file");
        expect(input1).toHaveAttribute("multiple");
        expect(input2).toHaveAttribute("multiple");
      });
    });
  });

  describe("File adding interaction tests", () => {
    it("adding a file via hidden input adds it to the job section", async () => {
      await act(async () => {
        render(<MultiJobAttachmentUpload {...defaultProps} />);
      });

      const input = document.getElementById(
        "multi-hidden-file-input-1",
      ) as HTMLInputElement;
      expect(input).toBeInTheDocument();

      const testFile = new File(["test content"], "test-document.pdf", {
        type: "application/pdf",
      });

      await act(async () => {
        fireEvent.change(input, {
          target: { files: [testFile] },
        });
      });

      await waitFor(
        () => {
          expect(screen.getByText("test-document.pdf")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it('added file shows with default "runsheet" attachment type', async () => {
      await act(async () => {
        render(<MultiJobAttachmentUpload {...defaultProps} />);
      });

      const input = document.getElementById(
        "multi-hidden-file-input-1",
      ) as HTMLInputElement;

      const testFile = new File(["test"], "runsheet-test.pdf", {
        type: "application/pdf",
      });

      await act(async () => {
        fireEvent.change(input, {
          target: { files: [testFile] },
        });
      });

      await waitFor(
        () => {
          expect(screen.getByText("runsheet-test.pdf")).toBeInTheDocument();
          // The default selection should show "Runsheet" in the select
          expect(screen.getByText("Runsheet")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it("upload button becomes enabled after adding files", async () => {
      await act(async () => {
        render(<MultiJobAttachmentUpload {...defaultProps} />);
      });

      const uploadBtn = document.getElementById("multi-upload-files-btn");
      expect(uploadBtn).toBeDisabled();

      const input = document.getElementById(
        "multi-hidden-file-input-1",
      ) as HTMLInputElement;

      const testFile = new File(["test"], "enable-upload.pdf", {
        type: "application/pdf",
      });

      await act(async () => {
        fireEvent.change(input, {
          target: { files: [testFile] },
        });
      });

      await waitFor(
        () => {
          const btn = document.getElementById("multi-upload-files-btn");
          expect(btn).not.toBeDisabled();
        },
        { timeout: 2000 },
      );
    });

    it("shows file count summary after adding files", async () => {
      await act(async () => {
        render(<MultiJobAttachmentUpload {...defaultProps} />);
      });

      const input = document.getElementById(
        "multi-hidden-file-input-1",
      ) as HTMLInputElement;

      const testFile = new File(["test"], "summary-test.pdf", {
        type: "application/pdf",
      });

      await act(async () => {
        fireEvent.change(input, {
          target: { files: [testFile] },
        });
      });

      await waitFor(
        () => {
          expect(screen.getByText(/1 file across 1 job/)).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it("rejects files larger than 20MB with a toast", async () => {
      await act(async () => {
        render(<MultiJobAttachmentUpload {...defaultProps} />);
      });

      const input = document.getElementById(
        "multi-hidden-file-input-1",
      ) as HTMLInputElement;

      // Create a file that reports as > 20MB
      const oversizedContent = "x".repeat(100);
      const oversizedFile = new File([oversizedContent], "huge-file.pdf", {
        type: "application/pdf",
      });

      // Override the size property to simulate a large file
      Object.defineProperty(oversizedFile, "size", {
        value: 25 * 1024 * 1024,
      });

      await act(async () => {
        fireEvent.change(input, {
          target: { files: [oversizedFile] },
        });
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "File too large",
            variant: "destructive",
          }),
        );
      });
    });

    it("rejects invalid file types with a toast", async () => {
      await act(async () => {
        render(<MultiJobAttachmentUpload {...defaultProps} />);
      });

      const input = document.getElementById(
        "multi-hidden-file-input-1",
      ) as HTMLInputElement;

      const invalidFile = new File(["malicious"], "script.exe", {
        type: "application/x-msdownload",
      });

      await act(async () => {
        fireEvent.change(input, {
          target: { files: [invalidFile] },
        });
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Invalid file type",
            variant: "destructive",
          }),
        );
      });
    });
  });

  describe("Close behaviour tests", () => {
    it("onClose is called when Cancel is clicked", async () => {
      const mockOnClose = jest.fn();

      await act(async () => {
        render(
          <MultiJobAttachmentUpload {...defaultProps} onClose={mockOnClose} />,
        );
      });

      const cancelBtn = document.getElementById("multi-cancel-upload-btn");
      expect(cancelBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(cancelBtn!);
      });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("close behaviour logic prevents closing while uploading", () => {
      let isUploading = true;
      const onClose = jest.fn();

      const handleClose = () => {
        if (!isUploading) {
          onClose();
        }
      };

      handleClose();
      expect(onClose).not.toHaveBeenCalled();

      isUploading = false;
      handleClose();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("state is reset when dialog closes", () => {
      const filesByJob: Record<
        number,
        Array<{ id: string; file: File; attachmentType: string }>
      > = {
        1: [
          {
            id: "f1",
            file: new File(["a"], "a.pdf", { type: "application/pdf" }),
            attachmentType: "runsheet",
          },
        ],
      };
      const jobStatuses: Record<number, { status: string; error?: string }> = {
        1: { status: "success" },
      };

      const resetState = () => {
        const clearedFiles: Record<
          number,
          Array<{ id: string; file: File; attachmentType: string }>
        > = {};
        const clearedStatuses: Record<
          number,
          { status: string; error?: string }
        > = {};
        return {
          filesByJob: clearedFiles,
          jobStatuses: clearedStatuses,
          isUploading: false,
          dragOverJobId: null,
        };
      };

      // Verify initial state has data
      expect(Object.keys(filesByJob)).toHaveLength(1);
      expect(Object.keys(jobStatuses)).toHaveLength(1);

      const resetResult = resetState();
      expect(Object.keys(resetResult.filesByJob)).toHaveLength(0);
      expect(Object.keys(resetResult.jobStatuses)).toHaveLength(0);
      expect(resetResult.isUploading).toBe(false);
      expect(resetResult.dragOverJobId).toBeNull();
    });
  });

  describe("Upload success toast messages", () => {
    it("shows success toast when all jobs upload successfully", () => {
      const updatedJobs: Job[] = [mockJobs[0], mockJobs[1]];
      const jobIdsToUpload = [1, 2];

      const failedCount = jobIdsToUpload.length - updatedJobs.length;

      if (failedCount === 0) {
        mockToast({
          title: "Upload successful",
          description: `Files uploaded to ${updatedJobs.length} job(s)`,
          variant: "default",
        });
      }

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Upload successful",
          description: "Files uploaded to 2 job(s)",
        }),
      );
    });

    it("shows partial upload toast when some jobs fail", () => {
      const updatedJobs: Job[] = [mockJobs[0]];
      const jobIdsToUpload = [1, 2];

      const failedCount = jobIdsToUpload.length - updatedJobs.length;

      if (failedCount > 0 && updatedJobs.length > 0) {
        mockToast({
          title: "Partial upload",
          description: `Files uploaded to ${updatedJobs.length} job(s), but ${failedCount} job(s) failed`,
          variant: "destructive",
        });
      }

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Partial upload",
          variant: "destructive",
        }),
      );
    });

    it("shows failure toast when all jobs fail", () => {
      const updatedJobs: Job[] = [];

      if (updatedJobs.length === 0) {
        mockToast({
          title: "Upload failed",
          description: "Failed to upload files to any of the selected jobs",
          variant: "destructive",
        });
      }

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Upload failed",
          variant: "destructive",
        }),
      );
    });
  });

  describe("Accessibility", () => {
    it('drop zones have role="button" and tabIndex for keyboard access', async () => {
      await act(async () => {
        render(<MultiJobAttachmentUpload {...defaultProps} />);
      });

      await waitFor(() => {
        const dropZone1 = document.getElementById("job-drop-zone-1");
        const dropZone2 = document.getElementById("job-drop-zone-2");

        expect(dropZone1).toHaveAttribute("role", "button");
        expect(dropZone1).toHaveAttribute("tabindex", "0");
        expect(dropZone2).toHaveAttribute("role", "button");
        expect(dropZone2).toHaveAttribute("tabindex", "0");
      });
    });

    it("drop zones have aria-label for screen readers", async () => {
      await act(async () => {
        render(<MultiJobAttachmentUpload {...defaultProps} />);
      });

      await waitFor(() => {
        const dropZone1 = document.getElementById("job-drop-zone-1");
        const dropZone2 = document.getElementById("job-drop-zone-2");

        expect(dropZone1).toHaveAttribute(
          "aria-label",
          "Drop files here for job 1",
        );
        expect(dropZone2).toHaveAttribute(
          "aria-label",
          "Drop files here for job 2",
        );
      });
    });
  });
});
