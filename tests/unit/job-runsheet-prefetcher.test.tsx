import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  JobRunsheetPrefetcher,
  JobRunsheetPreview,
} from "@/components/entities/job/job-runsheet-preview";
import type { Job } from "@/lib/types";

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }));

vi.mock("@/lib/api-client", () => ({ fetchJson: mocks.fetchJson }));

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockRunsheetPdf({ fileUrl }: { fileUrl: string }) {
      return <div data-testid="runsheet-pdf">{fileUrl}</div>;
    },
}));

function runsheetUrl({ fileId }: { fileId: string }) {
  return `https://drive.google.com/file/d/${fileId}/view?filename=${fileId}.pdf`;
}

function makeJob({ id, fileIds }: { id: number; fileIds: string[] }) {
  return {
    id,
    attachmentRunsheet: fileIds.map((fileId) => runsheetUrl({ fileId })),
  } as Job;
}

function requestedFileIds() {
  return mocks.fetchJson.mock.calls.map((call) => {
    const { url } = call[0] as { url: string };
    return new URL(url, "http://localhost").searchParams.get("fileId");
  });
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("JobRunsheetPrefetcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("downloads runsheets three at a time in display order", async () => {
    const pending = new Map<string, (value: unknown) => void>();
    mocks.fetchJson.mockImplementation(
      ({ url }: { url: string }) =>
        new Promise((resolve) => {
          const fileId = new URL(url, "http://localhost").searchParams.get("fileId") ?? "";
          pending.set(fileId, resolve);
        }),
    );

    const jobs = [
      makeJob({ id: 1, fileIds: ["a"] }),
      makeJob({ id: 2, fileIds: [] }),
      makeJob({ id: 3, fileIds: ["b", "c"] }),
      makeJob({ id: 4, fileIds: ["d"] }),
      makeJob({ id: 5, fileIds: ["e"] }),
    ];

    render(
      <QueryClientProvider client={makeQueryClient()}>
        <JobRunsheetPrefetcher jobs={jobs} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(requestedFileIds()).toEqual(["a", "b", "c"]));

    await act(async () => {
      pending.get("a")?.({ success: true, fileUrl: "data:application/pdf;base64,QQ==" });
    });
    await waitFor(() => expect(requestedFileIds()).toEqual(["a", "b", "c", "d"]));

    await act(async () => {
      pending.get("b")?.({ success: true, fileUrl: "data:application/pdf;base64,Qg==" });
      pending.get("c")?.({ success: true, fileUrl: "data:application/pdf;base64,Qw==" });
    });
    await waitFor(() =>
      expect(requestedFileIds()).toEqual(["a", "b", "c", "d", "e"]),
    );
  });

  it("cancels downloads for jobs that are no longer shown", async () => {
    const signals = new Map<string, AbortSignal>();
    mocks.fetchJson.mockImplementation(
      ({ url, init }: { url: string; init?: RequestInit }) => {
        const fileId =
          new URL(url, "http://localhost").searchParams.get("fileId") ?? "";
        if (init?.signal) signals.set(fileId, init.signal);
        return new Promise(() => {});
      },
    );
    const queryClient = makeQueryClient();

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <JobRunsheetPrefetcher
          jobs={[makeJob({ id: 1, fileIds: ["a", "b", "c"] })]}
        />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(requestedFileIds()).toEqual(["a", "b", "c"]));

    rerender(
      <QueryClientProvider client={queryClient}>
        <JobRunsheetPrefetcher
          jobs={[makeJob({ id: 2, fileIds: ["d", "e", "f"] })]}
        />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(requestedFileIds()).toEqual(["a", "b", "c", "d", "e", "f"]),
    );

    expect(["a", "b", "c"].map((fileId) => signals.get(fileId)?.aborted)).toEqual([
      true,
      true,
      true,
    ]);
    expect(["d", "e", "f"].map((fileId) => signals.get(fileId)?.aborted)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("does not retry failed downloads in the background", async () => {
    mocks.fetchJson.mockRejectedValue(new Error("Too many requests"));

    render(
      <QueryClientProvider client={makeQueryClient()}>
        <JobRunsheetPrefetcher jobs={[makeJob({ id: 1, fileIds: ["a"] })]} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mocks.fetchJson).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.fetchJson).toHaveBeenCalledTimes(1);
  });

  it("lets an expanded row show a prefetched runsheet without downloading it again", async () => {
    mocks.fetchJson.mockResolvedValue({
      success: true,
      fileUrl: "data:application/pdf;base64,QQ==",
    });
    const queryClient = makeQueryClient();
    const job = makeJob({ id: 1, fileIds: ["a"] });

    render(
      <QueryClientProvider client={queryClient}>
        <JobRunsheetPrefetcher jobs={[job]} />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(queryClient.getQueryState(["google-drive", "file", "a"])?.status).toBe(
        "success",
      ),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <JobRunsheetPreview job={job} />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("runsheet-pdf")).toHaveTextContent(
      "data:application/pdf;base64,QQ==",
    );
    expect(mocks.fetchJson).toHaveBeenCalledTimes(1);
  });
});
