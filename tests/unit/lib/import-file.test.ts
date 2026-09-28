/**
 * @vitest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import {
  MAX_IMPORT_FILE_BYTES,
  readImportFormData,
  rejectOversizedImportFile,
} from "@/lib/import-file";

const boundary = "worklog-test-boundary";

function multipartBody({ content }: { content: string }) {
  return [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="rows.csv"',
    "Content-Type: text/csv",
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

function uploadRequest({
  body,
  headers = {},
}: {
  body: BodyInit;
  headers?: Record<string, string>;
}) {
  return new NextRequest("http://localhost/api/import/jobs", {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      ...headers,
    },
    body,
    // Required by Node to send a streamed request body
    duplex: "half",
  } as ConstructorParameters<typeof NextRequest>[1]);
}

function streamOf({ totalBytes }: { totalBytes: number }) {
  const chunk = new Uint8Array(64 * 1024).fill(97);
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= totalBytes) {
        controller.close();
        return;
      }
      controller.enqueue(chunk);
      sent += chunk.byteLength;
    },
  });
}

describe("readImportFormData", () => {
  it("parses an upload within the limit", async () => {
    const result = await readImportFormData({
      request: uploadRequest({ body: multipartBody({ content: "a,b\n1,2" }) }),
    });

    expect(result).not.toBeInstanceOf(NextResponse);
    const file = (result as FormData).get("file") as File;
    expect(await file.text()).toBe("a,b\n1,2");
  });

  it("rejects a declared body over the limit before reading it", async () => {
    const body = streamOf({ totalBytes: 64 * 1024 });
    const request = uploadRequest({
      body,
      headers: { "Content-Length": String(MAX_IMPORT_FILE_BYTES * 2) },
    });

    const result = await readImportFormData({
      request,
      headers: { "X-RateLimit-Remaining": "4" },
    });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(413);
    expect((result as NextResponse).headers.get("X-RateLimit-Remaining")).toBe(
      "4",
    );
    expect(body.locked).toBe(false);
  });

  it("stops reading a streamed body once it passes the limit", async () => {
    const result = await readImportFormData({
      request: uploadRequest({
        body: streamOf({ totalBytes: MAX_IMPORT_FILE_BYTES * 3 }),
      }),
    });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(413);
  });

  it("rejects a body that is not valid multipart data", async () => {
    const result = await readImportFormData({
      request: uploadRequest({ body: "not multipart" }),
    });

    expect((result as NextResponse).status).toBe(400);
  });
});

describe("rejectOversizedImportFile", () => {
  it("allows a file at the limit and rejects one over it", () => {
    expect(
      rejectOversizedImportFile({
        file: { size: MAX_IMPORT_FILE_BYTES } as File,
      }),
    ).toBeNull();
    expect(
      rejectOversizedImportFile({
        file: { size: MAX_IMPORT_FILE_BYTES + 1 } as File,
      })?.status,
    ).toBe(413);
  });
});
