import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MultiJobAttachmentUpload } from "@/components/ui/multi-job-attachment-upload";
import type { SplitPdfFile } from "@/lib/utils/pdf-split";
import type { Job } from "@/lib/types";

global.fetch = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

interface FakeAssignerProps {
  onAddFiles: ({ files }: { files: SplitPdfFile[] }) => void;
  onSplittingChange: ({ isSplitting }: { isSplitting: boolean }) => void;
}

function FakeSplitPdfPageAssigner({
  onAddFiles,
  onSplittingChange,
}: FakeAssignerProps) {
  return (
    <>
      <button
        type="button"
        id="fake-start-split-btn"
        onClick={() => onSplittingChange({ isSplitting: true })}
      >
        Start split
      </button>
      <button
        type="button"
        id="fake-finish-split-btn"
        onClick={() => {
          onAddFiles({
            files: [
              {
                jobId: 2,
                attachmentType: "runsheet",
                pageIndexes: [0],
                file: new File(["split"], "week_p1.pdf", {
                  type: "application/pdf",
                }),
              },
            ],
          });
          onSplittingChange({ isSplitting: false });
        }}
      >
        Finish split
      </button>
    </>
  );
}

vi.mock("next/dynamic", () => ({
  default: () => FakeSplitPdfPageAssigner,
}));

function makeJob({ id, date }: { id: number; date: string }): Job {
  return {
    id,
    date,
    driver: `DRIVER ${id}`,
    customer: "ACME",
    billTo: "ACME",
    registration: "ABC123",
    truckType: "Tray",
    pickup: "Melbourne",
    dropoff: "Geelong",
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
  } as Job;
}

const jobs = [
  makeJob({ id: 1, date: "2026-10-26" }),
  makeJob({ id: 2, date: "2026-10-27" }),
];

function getButton({ id }: { id: string }): HTMLButtonElement {
  return document.getElementById(id) as HTMLButtonElement;
}

describe("MultiJobAttachmentUpload split PDF guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks upload, closing and tab changes while a PDF is splitting, then uploads the split pages", async () => {
    const fetchMock = global.fetch as vi.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, results: [] }),
    } as Response);

    render(
      <MultiJobAttachmentUpload
        isOpen
        onClose={vi.fn()}
        jobs={jobs}
        baseFolderId="base-folder"
        driveId="drive"
        onUploadSuccess={vi.fn()}
      />,
    );

    const input = document.getElementById(
      "multi-hidden-file-input-1",
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, {
        target: {
          files: [
            new File(["queued"], "queued.pdf", { type: "application/pdf" }),
          ],
        },
      });
    });
    expect(getButton({ id: "multi-upload-files-btn" })).toBeEnabled();

    await act(async () => {
      fireEvent.mouseDown(
        getButton({ id: "multi-upload-mode-split-pdf-tab" }),
      );
    });
    await act(async () => {
      fireEvent.click(getButton({ id: "fake-start-split-btn" }));
    });

    expect(getButton({ id: "multi-upload-files-btn" })).toBeDisabled();
    expect(getButton({ id: "multi-cancel-upload-btn" })).toBeDisabled();
    expect(getButton({ id: "multi-upload-mode-per-job-tab" })).toBeDisabled();

    await act(async () => {
      fireEvent.click(getButton({ id: "multi-upload-files-btn" }));
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(getButton({ id: "fake-finish-split-btn" }));
    });

    expect(screen.getByText("week_p1.pdf")).toBeInTheDocument();
    expect(getButton({ id: "multi-upload-files-btn" })).toBeEnabled();

    await act(async () => {
      fireEvent.click(getButton({ id: "multi-upload-files-btn" }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = fetchMock.mock.calls[0][1]?.body as FormData;
    const uploadedNames = body
      .getAll("files")
      .map((file) => (file as File).name);
    expect(uploadedNames).toEqual(["queued.pdf", "week_p1.pdf"]);
  });
});
