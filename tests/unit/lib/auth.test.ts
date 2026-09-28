/**
 * @vitest-environment node
 */
import { NextResponse } from "next/server";
import {
  forbidWithoutPermission,
  requireAuth,
  requireAuthWithPermission,
} from "@/lib/auth";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  checkPermission: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.findUnique } },
}));
vi.mock("@/lib/permissions", () => ({
  checkPermission: mocks.checkPermission,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user_1" });
  mocks.findUnique.mockResolvedValue({ isActive: true });
  mocks.checkPermission.mockResolvedValue(true);
});

describe("requireAuth", () => {
  it("rejects a signed-out request", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const result = await requireAuth();

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a user an admin has deactivated", async () => {
    mocks.findUnique.mockResolvedValue({ isActive: false });

    const result = await requireAuth();

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
    expect(await (result as NextResponse).json()).toEqual({
      error: "Forbidden - Account is deactivated",
    });
  });

  it("allows an active user", async () => {
    expect(await requireAuth()).toEqual({ userId: "user_1" });
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: "user_1" },
      select: { isActive: true },
    });
  });

  it("allows a user whose database record has not been created yet", async () => {
    mocks.findUnique.mockResolvedValue(null);

    expect(await requireAuth()).toEqual({ userId: "user_1" });
  });
});

describe("requireAuthWithPermission", () => {
  it("rejects a user whose role lacks the permission", async () => {
    mocks.checkPermission.mockResolvedValue(false);

    const result = await requireAuthWithPermission({
      permission: "manage_integrations",
      headers: { "X-RateLimit-Remaining": "9" },
    });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
    expect((result as NextResponse).headers.get("X-RateLimit-Remaining")).toBe(
      "9",
    );
    expect(mocks.checkPermission).toHaveBeenCalledWith("manage_integrations");
  });

  it("rejects a deactivated user before checking permissions", async () => {
    mocks.findUnique.mockResolvedValue({ isActive: false });

    const result = await requireAuthWithPermission({
      permission: "manage_integrations",
    });

    expect((result as NextResponse).status).toBe(403);
    expect(mocks.checkPermission).not.toHaveBeenCalled();
  });

  it("returns the auth result when the role has the permission", async () => {
    expect(
      await requireAuthWithPermission({ permission: "manage_integrations" }),
    ).toEqual({ userId: "user_1" });
  });
});

describe("forbidWithoutPermission", () => {
  it("returns null when the role has the permission", async () => {
    expect(
      await forbidWithoutPermission({ permission: "delete_jobs" }),
    ).toBeNull();
  });

  it("returns a 403 when the role lacks the permission", async () => {
    mocks.checkPermission.mockResolvedValue(false);

    const result = await forbidWithoutPermission({ permission: "delete_jobs" });

    expect(result?.status).toBe(403);
  });
});
