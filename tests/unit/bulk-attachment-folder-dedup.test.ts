import { describe, it, expect } from "vitest";
import { computeJobFolderKey } from "@/lib/utils/attachment-utils";

interface TestJob {
  id: number;
  date: string;
  customer: string;
  billTo: string;
}

/**
 * Mirrors the server-side grouping: resolve each unique folder key once.
 */
function countUniqueFolders(jobs: TestJob[]): number {
  const keys = new Set<string>();
  for (const job of jobs) {
    const { folderKey } = computeJobFolderKey({ job });
    keys.add(folderKey);
  }
  return keys.size;
}

describe("computeJobFolderKey", () => {
  it("produces the same key for jobs sharing week + customer + billTo", () => {
    const a = computeJobFolderKey({
      job: { date: "2026-04-20", customer: "Acme", billTo: "Acme" },
    });
    const b = computeJobFolderKey({
      job: { date: "2026-04-22", customer: "Acme", billTo: "Acme" },
    });

    // Both Monday and Wednesday of the same week resolve to the same Sunday.
    expect(a.folderKey).toBe(b.folderKey);
  });

  it("produces different keys for different customers", () => {
    const a = computeJobFolderKey({
      job: { date: "2026-04-20", customer: "Acme", billTo: "Acme" },
    });
    const b = computeJobFolderKey({
      job: { date: "2026-04-20", customer: "Globex", billTo: "Globex" },
    });

    expect(a.folderKey).not.toBe(b.folderKey);
  });

  it("produces different keys when billTo differs from customer", () => {
    const sameParty = computeJobFolderKey({
      job: { date: "2026-04-20", customer: "Acme", billTo: "Acme" },
    });
    const splitParty = computeJobFolderKey({
      job: { date: "2026-04-20", customer: "Acme", billTo: "Globex" },
    });

    expect(splitParty.customerBillToFolder).toBe("Acme_Globex");
    expect(splitParty.folderKey).not.toBe(sameParty.folderKey);
  });

  it("produces different keys for different weeks", () => {
    const week1 = computeJobFolderKey({
      job: { date: "2026-04-20", customer: "Acme", billTo: "Acme" },
    });
    const week2 = computeJobFolderKey({
      job: { date: "2026-04-27", customer: "Acme", billTo: "Acme" },
    });

    expect(week1.folderKey).not.toBe(week2.folderKey);
  });

  it("collapses a batch with the same customer into one folder", () => {
    const jobs: TestJob[] = [
      { id: 1, date: "2026-04-20", customer: "Acme", billTo: "Acme" },
      { id: 2, date: "2026-04-21", customer: "Acme", billTo: "Acme" },
      { id: 3, date: "2026-04-22", customer: "Acme", billTo: "Acme" },
    ];

    // The duplication bug: previously this created 3 "Acme" folders.
    expect(countUniqueFolders(jobs)).toBe(1);
  });

  it("creates separate folders for distinct customer/billTo combinations", () => {
    const jobs: TestJob[] = [
      { id: 1, date: "2026-04-20", customer: "Acme", billTo: "Acme" },
      { id: 2, date: "2026-04-20", customer: "Acme", billTo: "Acme" },
      { id: 3, date: "2026-04-20", customer: "Globex", billTo: "Globex" },
      { id: 4, date: "2026-04-20", customer: "Acme", billTo: "Globex" },
    ];

    // Acme/Acme (x2 -> 1), Globex/Globex, Acme/Globex = 3 unique folders.
    expect(countUniqueFolders(jobs)).toBe(3);
  });
});
