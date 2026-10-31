import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JobRunsheetPreview } from "@/components/entities/job/job-runsheet-preview";
import type { Job } from "@/lib/types";

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }));

vi.mock("@/lib/api-client", () => ({ fetchJson: mocks.fetchJson }));

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockRunsheetPdf({ fileUrl }: { fileUrl: string }) {
      return <div data-testid="runsheet-pdf">{fileUrl}</div>;
    },
}));

const runsheetUrl =
  "https://drive.google.com/file/d/abc123/view?filename=Runsheet%20Tilling.pdf";

function makeJob({ attachmentRunsheet }: { attachmentRunsheet: string[] }) {
  return { id: 7, attachmentRunsheet } as Job;
}

function renderPreview({ job }: { job: Job }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <JobRunsheetPreview job={job} />
    </QueryClientProvider>,
  );
}

describe("JobRunsheetPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty state when the job has no runsheet", () => {
    renderPreview({ job: makeJob({ attachmentRunsheet: [] }) });

    expect(
      screen.getByText("No runsheet attached to this job"),
    ).toBeInTheDocument();
    expect(mocks.fetchJson).not.toHaveBeenCalled();
  });

  it("loads the runsheet from Google Drive and renders it as a PDF", async () => {
    mocks.fetchJson.mockResolvedValue({
      success: true,
      fileUrl: "data:application/pdf;base64,JVBERi0=",
    });

    renderPreview({ job: makeJob({ attachmentRunsheet: [runsheetUrl] }) });

    expect(screen.getByText("Runsheet Tilling.pdf")).toBeInTheDocument();
    expect(await screen.findByTestId("runsheet-pdf")).toHaveTextContent(
      "data:application/pdf;base64,JVBERi0=",
    );
    expect(mocks.fetchJson).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/google-drive/get-file?fileId=abc123",
      }),
    );
    expect(
      screen.getByRole("link", { name: "Open in Drive" }),
    ).toHaveAttribute("href", "https://drive.google.com/file/d/abc123/view");
  });

  it("renders image runsheets as an image", async () => {
    mocks.fetchJson.mockResolvedValue({
      success: true,
      fileUrl: "data:image/jpeg;base64,/9j/",
    });

    renderPreview({ job: makeJob({ attachmentRunsheet: [runsheetUrl] }) });

    expect(
      await screen.findByRole("img", { name: "Runsheet Tilling.pdf" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("runsheet-pdf")).not.toBeInTheDocument();
  });

  it("shows an error when the runsheet cannot be loaded", async () => {
    mocks.fetchJson.mockRejectedValue(new Error("Drive unavailable"));

    renderPreview({ job: makeJob({ attachmentRunsheet: [runsheetUrl] }) });

    expect(
      await screen.findByText("Failed to load the runsheet from Google Drive"),
    ).toBeInTheDocument();
  });
});
