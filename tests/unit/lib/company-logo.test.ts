/**
 * @vitest-environment node
 */
import {
  buildCompanyLogoAssets,
  LOGO_FETCH_TIMEOUT_MS,
} from "@/lib/company-logo";

const mockFetch = vi.fn<typeof fetch>();

function createImageResponse({
  body = "fake-image-data",
  contentType = "image/png",
}: {
  body?: string;
  contentType?: string;
} = {}) {
  return new Response(Buffer.from(body), {
    status: 200,
    headers: { "content-type": contentType },
  });
}

function toBase64DataUrl({
  body,
  contentType,
}: {
  body: string;
  contentType: string;
}) {
  return `data:${contentType};base64,${Buffer.from(body).toString("base64")}`;
}

describe("buildCompanyLogoAssets", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    vi.stubEnv("LOGO_ORIGIN", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("LOGO_ALLOWED_HOSTS", "");
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    consoleErrorSpy.mockRestore();
  });

  it("returns empty assets without fetching when no logo is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com.au");

    const result = await buildCompanyLogoAssets({ companyLogo: null });

    expect(result).toEqual({ logoDataUrl: "", logoPublicUrl: null });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty assets for an empty logo string", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com.au");

    const result = await buildCompanyLogoAssets({ companyLogo: "" });

    expect(result).toEqual({ logoDataUrl: "", logoPublicUrl: null });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("resolves a relative logo path against NEXT_PUBLIC_APP_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com.au");
    mockFetch.mockResolvedValue(createImageResponse({}));

    const result = await buildCompanyLogoAssets({
      companyLogo: "/uploads/company-logo.png",
    });

    const expectedUrl = "https://app.example.com.au/uploads/company-logo.png";
    expect(mockFetch).toHaveBeenCalledWith(expectedUrl, {
      signal: expect.any(AbortSignal),
    });
    expect(result).toEqual({
      logoDataUrl: toBase64DataUrl({
        body: "fake-image-data",
        contentType: "image/png",
      }),
      logoPublicUrl: expectedUrl,
    });
  });

  it("prefers LOGO_ORIGIN over NEXT_PUBLIC_APP_URL for relative paths", async () => {
    vi.stubEnv("LOGO_ORIGIN", "https://assets.example.com.au");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com.au");
    mockFetch.mockResolvedValue(createImageResponse({}));

    const result = await buildCompanyLogoAssets({
      companyLogo: "  /uploads/company-logo.png  ",
    });

    expect(result.logoPublicUrl).toBe(
      "https://assets.example.com.au/uploads/company-logo.png",
    );
  });

  it("defaults the content type to image/png when the response has none", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com.au");
    mockFetch.mockResolvedValue(
      new Response(Buffer.from("fake-image-data"), { status: 200 }),
    );

    const result = await buildCompanyLogoAssets({
      companyLogo: "/uploads/company-logo.png",
    });

    expect(result.logoDataUrl).toBe(
      toBase64DataUrl({ body: "fake-image-data", contentType: "image/png" }),
    );
  });

  it("fetches an absolute logo URL on the trusted origin host", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com.au");
    mockFetch.mockResolvedValue(createImageResponse({}));

    const logoUrl = "https://app.example.com.au/uploads/company-logo.png";
    const result = await buildCompanyLogoAssets({ companyLogo: logoUrl });

    expect(mockFetch).toHaveBeenCalledWith(logoUrl, {
      signal: expect.any(AbortSignal),
    });
    expect(result.logoPublicUrl).toBe(logoUrl);
  });

  it("fetches an absolute logo URL on a host listed in LOGO_ALLOWED_HOSTS", async () => {
    vi.stubEnv(
      "LOGO_ALLOWED_HOSTS",
      " cdn.example.com.au , Store.Public.Blob.Vercel-Storage.com ",
    );
    mockFetch.mockResolvedValue(
      createImageResponse({ body: "jpeg-bytes", contentType: "image/jpeg" }),
    );

    const logoUrl =
      "https://store.public.blob.vercel-storage.com/uploads/image_123.jpg";
    const result = await buildCompanyLogoAssets({ companyLogo: logoUrl });

    expect(mockFetch).toHaveBeenCalledWith(logoUrl, {
      signal: expect.any(AbortSignal),
    });
    expect(result).toEqual({
      logoDataUrl: toBase64DataUrl({
        body: "jpeg-bytes",
        contentType: "image/jpeg",
      }),
      logoPublicUrl: logoUrl,
    });
  });

  it("blocks an absolute logo URL outside the allowed hosts without fetching", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com.au");
    vi.stubEnv("LOGO_ALLOWED_HOSTS", "cdn.example.com.au");

    const result = await buildCompanyLogoAssets({
      companyLogo: "http://169.254.169.254/latest/meta-data/",
    });

    expect(result).toEqual({ logoDataUrl: "", logoPublicUrl: null });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Blocked company logo URL outside allowed hosts.",
    );
  });

  it("fetches an https Vercel Blob logo URL without LOGO_ALLOWED_HOSTS configured", async () => {
    mockFetch.mockResolvedValue(createImageResponse({}));

    const logoUrl =
      "https://abc123xyz.public.blob.vercel-storage.com/uploads/image_123.png";
    const result = await buildCompanyLogoAssets({ companyLogo: logoUrl });

    expect(mockFetch).toHaveBeenCalledWith(logoUrl, {
      signal: expect.any(AbortSignal),
    });
    expect(result).toEqual({
      logoDataUrl: toBase64DataUrl({
        body: "fake-image-data",
        contentType: "image/png",
      }),
      logoPublicUrl: logoUrl,
    });
  });

  it.each([
    "https://evilpublic.blob.vercel-storage.com.attacker.com/logo.png",
    "https://abc123xyz.public.blob.vercel-storage.com.attacker.com/logo.png",
    "https://evilpublic.blob.vercel-storage.com/logo.png",
    "https://public.blob.vercel-storage.com/logo.png",
  ])("blocks the Vercel Blob lookalike host %s without fetching", async (logoUrl) => {
    const result = await buildCompanyLogoAssets({ companyLogo: logoUrl });

    expect(result).toEqual({ logoDataUrl: "", logoPublicUrl: null });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Blocked company logo URL outside allowed hosts.",
    );
  });

  it("blocks an http Vercel Blob logo URL without fetching", async () => {
    const result = await buildCompanyLogoAssets({
      companyLogo:
        "http://abc123xyz.public.blob.vercel-storage.com/uploads/image_123.png",
    });

    expect(result).toEqual({ logoDataUrl: "", logoPublicUrl: null });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty assets for a relative path when no trusted origin is configured", async () => {
    const result = await buildCompanyLogoAssets({
      companyLogo: "/uploads/company-logo.png",
    });

    expect(result).toEqual({ logoDataUrl: "", logoPublicUrl: null });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Cannot resolve relative company logo path without a trusted logo origin.",
    );
  });

  it("treats a non-http(s) trusted origin as unconfigured", async () => {
    vi.stubEnv("LOGO_ORIGIN", "ftp://files.example.com.au");

    const result = await buildCompanyLogoAssets({
      companyLogo: "/uploads/company-logo.png",
    });

    expect(result).toEqual({ logoDataUrl: "", logoPublicUrl: null });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Invalid logo origin configured. Expected an http(s) URL.",
    );
  });

  it("keeps the public URL but returns an empty data URL for a non-ok response", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com.au");
    mockFetch.mockResolvedValue(
      new Response("Not found", { status: 404, statusText: "Not Found" }),
    );

    const result = await buildCompanyLogoAssets({
      companyLogo: "/uploads/missing.png",
    });

    expect(result).toEqual({
      logoDataUrl: "",
      logoPublicUrl: "https://app.example.com.au/uploads/missing.png",
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error fetching logo file:",
      "Not Found",
    );
  });

  it("returns an empty data URL when the fetch rejects", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com.au");
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await buildCompanyLogoAssets({
      companyLogo: "/uploads/company-logo.png",
    });

    expect(result).toEqual({
      logoDataUrl: "",
      logoPublicUrl: "https://app.example.com.au/uploads/company-logo.png",
    });
  });

  it("aborts the fetch and returns an empty data URL after the timeout", async () => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com.au");
    mockFetch.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );

    const resultPromise = buildCompanyLogoAssets({
      companyLogo: "/uploads/slow-logo.png",
    });

    await vi.advanceTimersByTimeAsync(LOGO_FETCH_TIMEOUT_MS - 1);
    const signal = mockFetch.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const result = await resultPromise;

    expect(signal?.aborted).toBe(true);
    expect(result).toEqual({
      logoDataUrl: "",
      logoPublicUrl: "https://app.example.com.au/uploads/slow-logo.png",
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `Error fetching logo file: request timed out after ${LOGO_FETCH_TIMEOUT_MS}ms`,
    );
  });

  it("clears the timeout once the fetch completes", async () => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com.au");
    mockFetch.mockResolvedValue(createImageResponse({}));

    await buildCompanyLogoAssets({ companyLogo: "/uploads/company-logo.png" });

    expect(vi.getTimerCount()).toBe(0);
  });
});
