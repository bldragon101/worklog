import { getDownloadableRctis } from "@/lib/utils/rcti-downloads";
import type { Rcti, RctiLine } from "@/lib/types";

function createRcti({
  id,
  driverId,
  status,
  lineCount,
}: {
  id: number;
  driverId: number;
  status: Rcti["status"];
  lineCount: number;
}): Rcti {
  return {
    id,
    driverId,
    status,
    lines: Array.from({ length: lineCount }, () => ({}) as RctiLine),
  } as Rcti;
}

const rctis = [
  createRcti({ id: 1, driverId: 10, status: "draft", lineCount: 2 }),
  createRcti({ id: 2, driverId: 10, status: "finalised", lineCount: 0 }),
  createRcti({ id: 3, driverId: 20, status: "finalised", lineCount: 1 }),
];

function ids({ result }: { result: Rcti[] }) {
  return result.map((rcti) => rcti.id);
}

describe("getDownloadableRctis", () => {
  it("returns every RCTI with lines when no filters are set", () => {
    const result = getDownloadableRctis({
      rctis,
      selectedDriverIds: [],
      statusFilter: "all",
    });

    expect(ids({ result })).toEqual([1, 3]);
  });

  it("applies the driver and status filters", () => {
    const result = getDownloadableRctis({
      rctis,
      selectedDriverIds: ["20"],
      statusFilter: "finalised",
    });

    expect(ids({ result })).toEqual([3]);
  });

  it("returns nothing when every matching RCTI has no lines", () => {
    const result = getDownloadableRctis({
      rctis,
      selectedDriverIds: ["10"],
      statusFilter: "finalised",
    });

    expect(result).toEqual([]);
  });
});
