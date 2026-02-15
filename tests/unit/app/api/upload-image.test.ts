/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/upload-image/route";

const mockPut = jest.fn();

jest.mock("@vercel/blob", () => ({
  put: (...args: unknown[]) => mockPut(...args),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue({ userId: "test-user-123" }),
}));

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({
    headers: {
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "99",
    },
  }),
  rateLimitConfigs: {
    upload: {},
  },
}));

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
const GIF_SIGNATURE = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
const WEBP_SIGNATURE = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

function createMockFile({
  name,
  type,
  content,
}: {
  name: string;
  type: string;
  content: Buffer;
}): File {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

function createUploadRequest({ formData }: { formData: FormData }): NextRequest {
  return new NextRequest("http://localhost:3000/api/upload-image", {
    method: "POST",
    body: formData,
  });
}

describe("Upload Image API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPut.mockResolvedValue({
      url: "https://blob.vercel-storage.com/uploads/image_123_abc.png",
      pathname: "uploads/image_123_abc.png",
    });
  });

  describe("file presence validation", () => {
    it("should return 400 when no image field is provided", async () => {
      const formData = new FormData();
      const request = createUploadRequest({ formData });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("No image file provided");
    });

    it("should return 400 when image field is a string instead of a file", async () => {
      const formData = new FormData();
      formData.append("image", "not-a-file");
      const request = createUploadRequest({ formData });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("No image file provided");
    });
  });

  describe("file type validation", () => {
    it("should reject unsupported file types", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "document.pdf",
        type: "application/pdf",
        content: Buffer.from("fake-pdf-content-padding"),
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid file type");
    });

    it("should reject SVG files", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "icon.svg",
        type: "image/svg+xml",
        content: Buffer.from("<svg></svg>padpadpad"),
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid file type");
    });

    it("should reject BMP files", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "image.bmp",
        type: "image/bmp",
        content: Buffer.from("BM fake bmp content"),
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("should accept image/jpeg type", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "photo.jpg",
        type: "image/jpeg",
        content: JPEG_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should accept image/jpg type", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "photo.jpg",
        type: "image/jpg",
        content: JPEG_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("should accept image/png type", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "logo.png",
        type: "image/png",
        content: PNG_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("should accept image/gif type", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "animated.gif",
        type: "image/gif",
        content: GIF_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("should accept image/webp type", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "modern.webp",
        type: "image/webp",
        content: WEBP_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe("file size validation", () => {
    it("should reject files larger than 5MB", async () => {
      const largeContent = Buffer.alloc(5 * 1024 * 1024 + 1);
      PNG_SIGNATURE.copy(largeContent);

      const formData = new FormData();
      const file = createMockFile({
        name: "huge.png",
        type: "image/png",
        content: largeContent,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("5MB");
    });

    it("should accept files at exactly 5MB", async () => {
      const exactContent = Buffer.alloc(5 * 1024 * 1024);
      PNG_SIGNATURE.copy(exactContent);

      const formData = new FormData();
      const file = createMockFile({
        name: "exact.png",
        type: "image/png",
        content: exactContent,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe("filename validation", () => {
    it("should reject filenames with path traversal (..)", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "../../../etc/passwd",
        type: "image/png",
        content: PNG_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid file name");
    });

    it("should reject filenames with forward slashes", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "path/to/file.png",
        type: "image/png",
        content: PNG_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid file name");
    });

    it("should reject filenames with backslashes", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "path\\to\\file.png",
        type: "image/png",
        content: PNG_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid file name");
    });
  });

  describe("magic byte validation", () => {
    it("should reject a file with valid MIME type but invalid magic bytes", async () => {
      const fakeContent = Buffer.alloc(20, 0x00);

      const formData = new FormData();
      const file = createMockFile({
        name: "fake.png",
        type: "image/png",
        content: fakeContent,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid image file");
    });

    it("should reject a file with fewer than 12 bytes", async () => {
      const tinyContent = Buffer.from([0x89, 0x50, 0x4e]);

      const formData = new FormData();
      const file = createMockFile({
        name: "tiny.png",
        type: "image/png",
        content: tinyContent,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid image file");
    });

    it("should accept PNG with valid magic bytes", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "valid.png",
        type: "image/png",
        content: PNG_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("should accept JPEG with valid magic bytes", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "valid.jpg",
        type: "image/jpeg",
        content: JPEG_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("should accept GIF with valid magic bytes", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "valid.gif",
        type: "image/gif",
        content: GIF_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("should accept WebP with valid RIFF+WEBP magic bytes", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "valid.webp",
        type: "image/webp",
        content: WEBP_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("should reject RIFF container that is not WebP", async () => {
      const riffNonWebp = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20,
      ]);

      const formData = new FormData();
      const file = createMockFile({
        name: "video.webp",
        type: "image/webp",
        content: riffNonWebp,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid image file");
    });
  });

  describe("successful upload", () => {
    it("should call Vercel Blob put with correct parameters", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "logo.png",
        type: "image/png",
        content: PNG_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      await POST(request);

      expect(mockPut).toHaveBeenCalledTimes(1);
      const [blobPath, , options] = mockPut.mock.calls[0];

      expect(blobPath).toMatch(/^uploads\/image_\d+_[a-z0-9]+\.png$/);
      expect(options).toEqual(
        expect.objectContaining({
          access: "public",
          addRandomSuffix: false,
          contentType: "image/png",
        }),
      );
    });

    it("should use .jpg extension for image/jpeg", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "photo.jpeg",
        type: "image/jpeg",
        content: JPEG_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      await POST(request);

      const [blobPath] = mockPut.mock.calls[0];
      expect(blobPath).toMatch(/\.jpg$/);
    });

    it("should use .gif extension for image/gif", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "animation.gif",
        type: "image/gif",
        content: GIF_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      await POST(request);

      const [blobPath] = mockPut.mock.calls[0];
      expect(blobPath).toMatch(/\.gif$/);
    });

    it("should use .webp extension for image/webp", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "image.webp",
        type: "image/webp",
        content: WEBP_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      await POST(request);

      const [blobPath] = mockPut.mock.calls[0];
      expect(blobPath).toMatch(/\.webp$/);
    });

    it("should return success response with image URL and metadata", async () => {
      mockPut.mockResolvedValue({
        url: "https://blob.vercel-storage.com/uploads/image_999_xyz.png",
        pathname: "uploads/image_999_xyz.png",
      });

      const formData = new FormData();
      const file = createMockFile({
        name: "logo.png",
        type: "image/png",
        content: PNG_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.imageUrl).toBe(
        "https://blob.vercel-storage.com/uploads/image_999_xyz.png",
      );
      expect(data.fileName).toBe("uploads/image_999_xyz.png");
      expect(data.fileType).toBe("image/png");
      expect(typeof data.fileSize).toBe("number");
    });

    it("should include rate limit headers in successful response", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "logo.png",
        type: "image/png",
        content: PNG_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });
  });

  describe("error handling", () => {
    it("should return 500 when Vercel Blob put throws", async () => {
      mockPut.mockRejectedValue(new Error("Blob storage unavailable"));

      const formData = new FormData();
      const file = createMockFile({
        name: "logo.png",
        type: "image/png",
        content: PNG_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Internal server error");
    });

    it("should log error to console when upload fails", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const uploadError = new Error("Storage quota exceeded");

      mockPut.mockRejectedValue(uploadError);

      const formData = new FormData();
      const file = createMockFile({
        name: "logo.png",
        type: "image/png",
        content: PNG_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      await POST(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Image upload error:",
        uploadError,
      );

      consoleSpy.mockRestore();
    });

    it("should include rate limit headers in error responses", async () => {
      const formData = new FormData();
      const request = createUploadRequest({ formData });
      const response = await POST(request);

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });
  });

  describe("generated blob path", () => {
    it("should generate unique paths for consecutive uploads", async () => {
      const paths: string[] = [];
      mockPut.mockImplementation((path: string) => {
        paths.push(path);
        return Promise.resolve({
          url: `https://blob.vercel-storage.com/${path}`,
          pathname: path,
        });
      });

      for (let i = 0; i < 3; i++) {
        const formData = new FormData();
        const file = createMockFile({
          name: "logo.png",
          type: "image/png",
          content: PNG_SIGNATURE,
        });
        formData.append("image", file);

        const request = createUploadRequest({ formData });
        await POST(request);
      }

      const uniquePaths = new Set(paths);
      expect(uniquePaths.size).toBe(3);
    });

    it("should always start with uploads/ prefix", async () => {
      const formData = new FormData();
      const file = createMockFile({
        name: "test.png",
        type: "image/png",
        content: PNG_SIGNATURE,
      });
      formData.append("image", file);

      const request = createUploadRequest({ formData });
      await POST(request);

      const [blobPath] = mockPut.mock.calls[0];
      expect(blobPath).toMatch(/^uploads\//);
    });
  });
});
