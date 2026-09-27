import { NextRequest } from "next/server";
import { GET as exportDrivers } from "@/app/api/export/drivers/route";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { driver: { findMany: mocks.findMany } },
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user" }),
}));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ headers: {} }),
  rateLimitConfigs: { general: {} },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany.mockResolvedValue([]);
});

async function exportWhere({ query }: { query: string }) {
  await exportDrivers(
    new NextRequest(
      `http://localhost/api/export/drivers?driver=${encodeURIComponent(query)}`,
    ),
  );
  return mocks.findMany.mock.calls[0][0].where;
}

describe("driver export name filter", () => {
  it("matches the first or last name", async () => {
    expect(await exportWhere({ query: "smith" })).toEqual({
      OR: [
        { driver: { contains: "smith", mode: "insensitive" } },
        { lastName: { contains: "smith", mode: "insensitive" } },
      ],
    });
  });

  it("matches a query spanning first and last name", async () => {
    const where = await exportWhere({ query: "john smi" });
    expect(where.OR).toContainEqual({
      driver: { endsWith: "john", mode: "insensitive" },
      lastName: { startsWith: "smi", mode: "insensitive" },
    });
  });

  it("tries every space as the first/last name boundary", async () => {
    const where = await exportWhere({ query: "john paul smith" });
    expect(where.OR).toContainEqual({
      driver: { endsWith: "john paul", mode: "insensitive" },
      lastName: { startsWith: "smith", mode: "insensitive" },
    });
    expect(where.OR).toContainEqual({
      driver: { endsWith: "john", mode: "insensitive" },
      lastName: { startsWith: "paul smith", mode: "insensitive" },
    });
  });

  it("splits correctly after characters outside the BMP", async () => {
    const where = await exportWhere({ query: "A\u{10400} B" });
    expect(where.OR).toContainEqual({
      driver: { endsWith: "A\u{10400}", mode: "insensitive" },
      lastName: { startsWith: "B", mode: "insensitive" },
    });
  });

  it("keeps extra spaces so they must match exactly", async () => {
    const where = await exportWhere({ query: "john paul  smith" });
    expect(where.OR).toContainEqual({
      driver: { endsWith: "john paul", mode: "insensitive" },
      lastName: { startsWith: " smith", mode: "insensitive" },
    });
    expect(where.OR).not.toContainEqual({
      driver: { endsWith: "john paul", mode: "insensitive" },
      lastName: { startsWith: "smith", mode: "insensitive" },
    });
  });
});
