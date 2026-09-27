import { readFile } from "fs/promises";

/**
 * Extracts the text of every page in a PDF file, joined with spaces, so specs
 * can check what a downloaded document actually says.
 */
export async function readPdfText({ path }: { path: string }): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(path));
  const pdfDocument = await pdfjs.getDocument({ data }).promise;
  const pageNumbers = Array.from(
    { length: pdfDocument.numPages },
    (_, index) => index + 1,
  );
  const pages = await Promise.all(
    pageNumbers.map(async (pageNumber) => {
      const page = await pdfDocument.getPage(pageNumber);
      const content = await page.getTextContent();
      return content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
    }),
  );
  return pages.join(" ").replace(/\s+/g, " ");
}
