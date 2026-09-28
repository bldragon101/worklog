/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  checkPermission: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/permissions", () => ({
  checkPermission: mocks.checkPermission,
}));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ headers: {} }),
  rateLimitConfigs: { general: {} },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.findUnique, update: mocks.update } },
}));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    users: { banUser: mocks.banUser, unbanUser: mocks.unbanUser },
  }),
}));

import { PATCH } from "@/app/api/users/[id]/route";

const adminId = "user_admin";
const targetId = "user_target";

function patchUser({ id, body }: { id: string; body: unknown }) {
  return PATCH(
    new NextRequest(`http://localhost/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuth.mockResolvedValue({ userId: adminId });
  mocks.checkPermission.mockResolvedValue(true);
  mocks.banUser.mockResolvedValue({});
  mocks.unbanUser.mockResolvedValue({});
  mocks.update.mockImplementation(async ({ data }) => ({ id: targetId, ...data }));
});

describe("PATCH /api/users/[id] activation", () => {
  it("bans a deactivated user in Clerk so their sessions end", async () => {
    mocks.findUnique.mockResolvedValue({ id: targetId, isActive: true });

    const response = await patchUser({
      id: targetId,
      body: { isActive: false },
    });

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: targetId },
      data: expect.objectContaining({ isActive: false }),
    });
    expect(mocks.banUser).toHaveBeenCalledWith(targetId);
    expect(mocks.unbanUser).not.toHaveBeenCalled();
  });

  it("unbans a reactivated user in Clerk", async () => {
    mocks.findUnique.mockResolvedValue({ id: targetId, isActive: false });

    const response = await patchUser({ id: targetId, body: { isActive: true } });

    expect(response.status).toBe(200);
    expect(mocks.unbanUser).toHaveBeenCalledWith(targetId);
    expect(mocks.banUser).not.toHaveBeenCalled();
  });

  it("re-applies the ban when the database already says inactive", async () => {
    mocks.findUnique.mockResolvedValue({ id: targetId, isActive: false });

    const response = await patchUser({
      id: targetId,
      body: { isActive: false },
    });

    expect(response.status).toBe(200);
    expect(mocks.banUser).toHaveBeenCalledWith(targetId);
  });

  it("re-applies the unban when the database already says active", async () => {
    mocks.findUnique.mockResolvedValue({ id: targetId, isActive: true });

    const response = await patchUser({ id: targetId, body: { isActive: true } });

    expect(response.status).toBe(200);
    expect(mocks.unbanUser).toHaveBeenCalledWith(targetId);
  });

  it("saves nothing and reports failure when Clerk cannot ban the user", async () => {
    mocks.findUnique.mockResolvedValue({ id: targetId, isActive: true });
    mocks.banUser.mockRejectedValue(new Error("Clerk unavailable"));

    const response = await patchUser({
      id: targetId,
      body: { isActive: false },
    });

    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain("No changes were saved");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("saves nothing and reports failure when Clerk cannot unban the user", async () => {
    mocks.findUnique.mockResolvedValue({ id: targetId, isActive: false });
    mocks.unbanUser.mockRejectedValue(new Error("Clerk unavailable"));

    const response = await patchUser({ id: targetId, body: { isActive: true } });

    expect(response.status).toBe(502);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("bans in Clerk before saving to the database", async () => {
    mocks.findUnique.mockResolvedValue({ id: targetId, isActive: true });

    await patchUser({ id: targetId, body: { isActive: false } });

    expect(mocks.banUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.update.mock.invocationCallOrder[0],
    );
  });

  it("stops an admin from deactivating their own account", async () => {
    const response = await patchUser({
      id: adminId,
      body: { isActive: false },
    });

    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.banUser).not.toHaveBeenCalled();
  });
});
