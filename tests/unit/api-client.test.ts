import { ApiError, fetchJson } from "@/lib/api-client";

describe("fetchJson", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  it("returns the parsed JSON body on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: 1 }],
    });

    await expect(fetchJson({ url: "/api/customers" })).resolves.toEqual([
      { id: 1 },
    ]);
    expect(mockFetch).toHaveBeenCalledWith("/api/customers", undefined);
  });

  it("passes request options through to fetch", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    const init = { cache: "no-store" as const };

    await fetchJson({ url: "/api/rcti", init });

    expect(mockFetch).toHaveBeenCalledWith("/api/rcti", init);
  });

  it("throws an ApiError with the server's error message", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "Forbidden: admin only" }),
    });

    const error = await fetchJson({ url: "/api/users" }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message: "Forbidden: admin only",
      status: 403,
    });
  });

  it("falls back to the given message when the body has no error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    });

    await expect(
      fetchJson({ url: "/api/jobs", fallbackMessage: "Failed to fetch jobs" }),
    ).rejects.toThrow("Failed to fetch jobs");
  });
});
