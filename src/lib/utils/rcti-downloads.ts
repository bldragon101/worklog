import type { Rcti } from "@/lib/types";

/**
 * Returns the RCTIs that "Download All PDFs" would include: those matching the
 * driver and status filters that have at least one line.
 */
export function getDownloadableRctis({
  rctis,
  selectedDriverIds,
  statusFilter,
}: {
  rctis: Rcti[];
  selectedDriverIds: string[];
  statusFilter: string;
}): Rcti[] {
  return rctis.filter((rcti) => {
    const matchesDriver =
      selectedDriverIds.length === 0 ||
      selectedDriverIds.includes(rcti.driverId.toString());
    const matchesStatus =
      statusFilter === "all" || rcti.status === statusFilter;
    const hasLines = (rcti.lines?.length ?? 0) > 0;
    return matchesDriver && matchesStatus && hasLines;
  });
}
