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

function getBaseName({ fileName }: { fileName: string }): string {
  const lastDot = fileName.lastIndexOf(".");
  const base = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  return base.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60) || "document";
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
      const fileName = `${baseName}_${formatPageRanges({ pageIndexes: group.pageIndexes })}.pdf`;

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
