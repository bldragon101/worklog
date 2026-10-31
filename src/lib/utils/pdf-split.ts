import { PDFDocument } from "pdf-lib";
import {
  formatPageRanges,
  type PageGroup,
} from "@/lib/utils/pdf-page-matching";

export interface SplitPdfFile {
  jobId: number;
  attachmentType: PageGroup["attachmentType"];
  pageIndexes: number[];
  file: File;
}

const MAX_BASE_NAME_LENGTH = 60;
const MAX_PAGE_SUFFIX_LENGTH = 40;

function getBaseName({ fileName }: { fileName: string }): string {
  const lastDot = fileName.lastIndexOf(".");
  const base = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  return base.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, MAX_BASE_NAME_LENGTH) || "document";
}

/**
 * Describes a group's pages for its filename, falling back to the first and
 * last page plus a page count when the full list of ranges would be too long.
 */
export function buildPageSuffix({
  pageIndexes,
}: {
  pageIndexes: number[];
}): string {
  const ranges = formatPageRanges({ pageIndexes });
  if (ranges.length <= MAX_PAGE_SUFFIX_LENGTH) return ranges;
  const sorted = [...pageIndexes].sort((a, b) => a - b);
  const first = sorted[0] + 1;
  const last = sorted[sorted.length - 1] + 1;
  return `p${first}-${last}_${sorted.length}pages`;
}

/**
 * Copies each group's pages out of the source PDF into a new PDF file.
 */
export async function splitPdfIntoGroups({
  sourceBytes,
  sourceName,
  groups,
}: {
  sourceBytes: ArrayBuffer;
  sourceName: string;
  groups: PageGroup[];
}): Promise<SplitPdfFile[]> {
  const source = await PDFDocument.load(sourceBytes, {
    ignoreEncryption: true,
  });
  const pageCount = source.getPageCount();
  const baseName = getBaseName({ fileName: sourceName });

  return Promise.all(
    groups.map(async (group) => {
      const invalidIndex = group.pageIndexes.find(
        (index) => index < 0 || index >= pageCount,
      );
      if (invalidIndex !== undefined) {
        throw new Error(
          `Page ${invalidIndex + 1} does not exist in ${sourceName}`,
        );
      }

      const output = await PDFDocument.create();
      const copiedPages = await output.copyPages(source, group.pageIndexes);
      for (const page of copiedPages) {
        output.addPage(page);
      }
      const bytes = await output.save();
      const fileName = `${baseName}_${buildPageSuffix({ pageIndexes: group.pageIndexes })}.pdf`;

      return {
        jobId: group.jobId,
        attachmentType: group.attachmentType,
        pageIndexes: group.pageIndexes,
        file: new File([new Uint8Array(bytes)], fileName, {
          type: "application/pdf",
        }),
      };
    }),
  );
}
