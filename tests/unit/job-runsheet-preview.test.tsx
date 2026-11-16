import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JobRunsheetPreview } from "@/components/entities/job/job-runsheet-preview";
import type { Job } from "@/lib/types";

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }));

vi.mock("@/lib/api-client", () => ({ fetchJson: mocks.fetchJson }));

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockRunsheetPdf({
      fileUrl,
      width,
    }: {
      fileUrl: string;
      width: number;
    }) {
      return (
        <div data-testid="runsheet-pdf" data-width={width}>
          {fileUrl}
        </div>
      );
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

  describe("resizing", () => {
    const pdfUrl = "data:application/pdf;base64,JVBERi0=";

    async function renderLoadedPdf() {
      mocks.fetchJson.mockResolvedValue({ success: true, fileUrl: pdfUrl });
      renderPreview({ job: makeJob({ attachmentRunsheet: [runsheetUrl] }) });
      await screen.findByTestId("runsheet-pdf");
    }

    it("zooms in and out with the buttons and re-renders the PDF at the new width", async () => {
      await renderLoadedPdf();

      expect(screen.getByRole("button", { name: "Reset runsheet size" })).toHaveTextContent("Fit");

      fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));

      expect(screen.getByTestId("resizable-runsheet-surface")).toHaveStyle({ width: "1000px" });
      expect(screen.getByTestId("runsheet-pdf")).toHaveAttribute("data-width", "1000");
      expect(screen.getByRole("button", { name: "Reset runsheet size" })).toHaveTextContent("125%");

      fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
      fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));

      expect(screen.getByTestId("runsheet-pdf")).toHaveAttribute("data-width", "600");
      expect(screen.getByRole("button", { name: "Reset runsheet size" })).toHaveTextContent("75%");
    });

    it("zooms once per Enter key press on a zoom button", async () => {
      await renderLoadedPdf();

      fireEvent.keyDown(screen.getByRole("button", { name: "Zoom in" }), {
        key: "Enter",
      });

      expect(screen.getByTestId("runsheet-pdf")).toHaveAttribute(
        "data-width",
        "1000",
      );
    });

    it("resets to fit", async () => {
      await renderLoadedPdf();

      fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
      fireEvent.click(screen.getByRole("button", { name: "Reset runsheet size" }));

      expect(screen.getByTestId("resizable-runsheet-surface").style.width).toBe("");
      expect(screen.getByTestId("runsheet-pdf")).toHaveAttribute("data-width", "800");
      expect(screen.getByRole("button", { name: "Reset runsheet size" })).toHaveTextContent("Fit");
    });

    it("resizes with the arrow keys on the resize grip", async () => {
      await renderLoadedPdf();
      const grip = screen.getByRole("slider", { name: "Resize runsheet" });

      fireEvent.keyDown(grip, { key: "ArrowRight" });
      fireEvent.keyDown(grip, { key: "ArrowRight" });

      expect(grip).toHaveAttribute("aria-valuenow", "880");
      expect(screen.getByTestId("runsheet-pdf")).toHaveAttribute("data-width", "880");

      fireEvent.keyDown(grip, { key: "Escape" });

      expect(screen.getByTestId("runsheet-pdf")).toHaveAttribute("data-width", "800");
    });

    it("scales live while dragging and re-renders the PDF only on release", async () => {
      await renderLoadedPdf();
      const surface = screen.getByTestId("resizable-runsheet-surface");
      surface.setPointerCapture = vi.fn();

      fireEvent.pointerDown(surface, { button: 0, pointerId: 1, pointerType: "mouse", clientX: 100, clientY: 100 });
      fireEvent.pointerMove(surface, { pointerId: 1, clientX: 300, clientY: 150 });

      expect(surface).toHaveStyle({ width: "1000px" });
      expect(screen.getByTestId("runsheet-pdf")).toHaveAttribute("data-width", "800");

      fireEvent.pointerUp(surface, { pointerId: 1 });

      expect(screen.getByTestId("runsheet-pdf")).toHaveAttribute("data-width", "1000");
    });

    it("ignores other pointers while a resize is in progress", async () => {
      await renderLoadedPdf();
      const surface = screen.getByTestId("resizable-runsheet-surface");
      const grip = screen.getByRole("slider", { name: "Resize runsheet" });
      grip.setPointerCapture = vi.fn();

      fireEvent.pointerDown(grip, { button: 0, pointerId: 1, pointerType: "touch", clientX: 100, clientY: 100 });
      fireEvent.pointerDown(grip, { button: 0, pointerId: 2, pointerType: "touch", clientX: 500, clientY: 500 });
      fireEvent.pointerMove(surface, { pointerId: 2, clientX: 900, clientY: 500 });

      expect(surface.style.width).toBe("");

      fireEvent.pointerUp(surface, { pointerId: 2 });
      fireEvent.pointerMove(surface, { pointerId: 1, clientX: 200, clientY: 100 });

      expect(surface).toHaveStyle({ width: "900px" });

      fireEvent.pointerUp(surface, { pointerId: 1 });

      expect(screen.getByTestId("runsheet-pdf")).toHaveAttribute("data-width", "900");
    });

    it("ignores touch presses on the runsheet so the page can still scroll", async () => {
      await renderLoadedPdf();
      const surface = screen.getByTestId("resizable-runsheet-surface");
      surface.setPointerCapture = vi.fn();

      fireEvent.pointerDown(surface, { button: 0, pointerId: 1, pointerType: "touch", clientX: 100, clientY: 100 });
      fireEvent.pointerMove(surface, { pointerId: 1, clientX: 300, clientY: 100 });

      expect(surface.style.width).toBe("");
    });
  });
});
