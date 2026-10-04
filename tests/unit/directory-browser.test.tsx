import { fireEvent, screen, waitFor } from "@testing-library/react";
import { DirectoryBrowser } from "@/components/ui/directory-browser";
import { renderWithQueryClient } from "../helpers/query-client";

const rootFiles = [
  {
    id: "folder-1",
    name: "Jobs",
    mimeType: "application/vnd.google-apps.folder",
    createdTime: "2024-01-01T00:00:00Z",
    isFolder: true,
  },
];

describe("DirectoryBrowser", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  it("does not load until opened", () => {
    renderWithQueryClient({
      ui: <DirectoryBrowser isOpen={false} onClose={vi.fn()} driveId="d1" />,
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("loads the root folders when opened", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, files: rootFiles }),
    });

    renderWithQueryClient({
      ui: <DirectoryBrowser isOpen onClose={vi.fn()} driveId="d1" />,
    });

    expect(await screen.findByText("Jobs")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/google-drive/service-account?action=list-hierarchical-folders&driveId=d1&parentId=root",
    );
  });

  it("shows the error and asks the parent to reconnect when authorisation has expired", async () => {
    const onReauthRequired = vi.fn();
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        code: "REAUTH_REQUIRED",
        error: "Google Drive authorisation expired",
      }),
    });

    renderWithQueryClient({
      ui: (
        <DirectoryBrowser
          isOpen
          onClose={vi.fn()}
          driveId="d1"
          onReauthRequired={onReauthRequired}
        />
      ),
    });

    expect(
      await screen.findByText("Google Drive authorisation expired"),
    ).toBeInTheDocument();
    expect(onReauthRequired).toHaveBeenCalledTimes(1);
  });

  it("retries loading the root folders", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, error: "Drive unavailable" }),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, files: rootFiles }),
    });

    renderWithQueryClient({
      ui: <DirectoryBrowser isOpen onClose={vi.fn()} driveId="d1" />,
    });

    fireEvent.click(await screen.findByRole("button", { name: /retry/i }));

    await waitFor(() => expect(screen.getByText("Jobs")).toBeInTheDocument());
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
