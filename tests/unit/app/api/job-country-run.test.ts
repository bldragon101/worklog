import { NextRequest } from "next/server";
import { z } from "zod";
import { PATCH as updateJob } from "@/app/api/jobs/[id]/route";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobs: {
      create: mocks.create,
      update: mocks.update,
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
    },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user" }),
}));
vi.mock("@/lib/permissions", () => ({ getUserRole: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ headers: {} }),
  rateLimitConfigs: { general: {} },
}));
vi.mock("@/lib/activity-logger", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/utils/attachment-utils", () => ({
  syncJobAttachmentNames: vi.fn(),
}));
vi.mock("@/lib/attachment-config", () => ({
  getJobAttachmentConfig: vi.fn(),
}));
vi.mock("@/lib/write-security", () => ({
  secureWriteOperation: async (
    request: NextRequest,
    { schema }: { schema: z.ZodType },
  ) => ({
    success: true,
    data: schema.parse(await request.json()),
    userId: "test-user",
  }),
  sanitizeWriteData: (data: Record<string, unknown>) => data,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUnique.mockResolvedValue({ id: 1 });
  mocks.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: 1, ...data }),
  );
});

async function patch({ body }: { body: Record<string, unknown> }) {
  const response = await updateJob(
    new NextRequest("http://localhost/api/jobs/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "1" }) },
  );
  expect(response.status).toBe(200);
  return mocks.update.mock.calls[0][0].data as Record<string, unknown>;
}

describe("country run partial updates", () => {
  it("keeps the stored unit when only the value changes", async () => {
    const data = await patch({ body: { countryRunValue: 15 } });
    expect(data).toEqual({ countryRunValue: 15 });
  });

  it("updates the unit on its own", async () => {
    const data = await patch({ body: { countryRunUnit: "percentage" } });
    expect(data).toEqual({ countryRunUnit: "percentage" });
  });

  it("clears the unit when the value is cleared", async () => {
    const data = await patch({
      body: { countryRunValue: 0, countryRunUnit: "hours" },
    });
    expect(data).toEqual({ countryRunValue: null, countryRunUnit: null });
  });
});
