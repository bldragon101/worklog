/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import type { UserRole } from "@/lib/permissions";
import { GET as listDrivers, POST as createDriver } from "@/app/api/drivers/route";
import {
  GET as getDriver,
  PUT as updateDriver,
} from "@/app/api/drivers/[id]/route";

const mocks = vi.hoisted(() => ({
  role: { current: "admin" as UserRole },
  driverFindMany: vi.fn(),
  driverFindUnique: vi.fn(),
  driverCreate: vi.fn(),
  driverUpdate: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "user_1" }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: async () => ({ isActive: true }) },
    driver: {
      findMany: mocks.driverFindMany,
      findUnique: mocks.driverFindUnique,
      create: mocks.driverCreate,
      update: mocks.driverUpdate,
    },
  },
}));
vi.mock("@/lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/permissions")>()),
  getUserRole: async () => mocks.role.current,
  getCurrentUserRole: async () => mocks.role.current,
}));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ headers: {} }),
  rateLimitConfigs: { general: {} },
}));
vi.mock("@/lib/activity-logger", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

const storedDriver = {
  id: 7,
  driver: "ALEX",
  lastName: null,
  truck: "ABC123",
  tray: null,
  crane: null,
  semi: null,
  semiCrane: null,
  breaks: null,
  type: "Contractor",
  tolls: false,
  fuelLevy: null,
  email: null,
  businessName: "Alex Contracting",
  abn: "12345678901",
  address: null,
  bankAccountName: "Alex Contracting",
  bankAccountNumber: "12345678",
  bankBsb: "123456",
  gstMode: "exclusive",
  gstStatus: "registered",
  isArchived: false,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-01T00:00:00Z"),
};

const bankFields = ["bankAccountName", "bankAccountNumber", "bankBsb"];

const context = { params: Promise.resolve({ id: "7" }) };

function jsonRequest({ method, body }: { method: string; body: unknown }) {
  return new NextRequest("http://localhost/api/drivers/7", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.role.current = "admin";
  mocks.driverFindMany.mockResolvedValue([storedDriver]);
  mocks.driverFindUnique.mockResolvedValue(storedDriver);
  mocks.driverCreate.mockImplementation(async ({ data }) => ({
    ...storedDriver,
    ...data,
  }));
  mocks.driverUpdate.mockImplementation(async ({ data }) => ({
    ...storedDriver,
    ...data,
  }));
});

describe("driver bank details in API responses", () => {
  it.each<UserRole>(["manager", "user", "viewer"])(
    "leaves bank details out of the driver list for a %s",
    async (role) => {
      mocks.role.current = role;

      const response = await listDrivers(
        new NextRequest("http://localhost/api/drivers"),
      );
      const [driver] = await response.json();

      for (const field of bankFields) {
        expect(driver).not.toHaveProperty(field);
      }
      expect(driver).toMatchObject({ driver: "ALEX", abn: "12345678901" });
    },
  );

  it("includes bank details in the driver list for an admin", async () => {
    const response = await listDrivers(
      new NextRequest("http://localhost/api/drivers"),
    );
    const [driver] = await response.json();

    expect(driver).toMatchObject({
      bankAccountName: "Alex Contracting",
      bankAccountNumber: "12345678",
      bankBsb: "123456",
    });
  });

  it("leaves bank details out of a single driver for a manager", async () => {
    mocks.role.current = "manager";

    const response = await getDriver(
      new NextRequest("http://localhost/api/drivers/7"),
      context,
    );
    const driver = await response.json();

    for (const field of bankFields) {
      expect(driver).not.toHaveProperty(field);
    }
  });
});

describe("driver bank details in writes", () => {
  it("ignores bank details sent by a manager on update", async () => {
    mocks.role.current = "manager";

    const response = await updateDriver(
      jsonRequest({
        method: "PUT",
        body: { truck: "XYZ789", bankBsb: "999999", bankAccountNumber: "1" },
      }),
      context,
    );

    expect(response.status).toBe(200);
    const { data } = mocks.driverUpdate.mock.calls[0][0];
    expect(data).toMatchObject({ truck: "XYZ789" });
    const driver = await response.json();
    for (const field of bankFields) {
      expect(data).not.toHaveProperty(field);
      expect(driver).not.toHaveProperty(field);
    }
  });

  it("ignores bank details sent by a manager on create", async () => {
    mocks.role.current = "manager";

    const response = await createDriver(
      jsonRequest({
        method: "POST",
        body: {
          driver: "Sam",
          truck: "SAM001",
          type: "Contractor",
          bankBsb: "999999",
        },
      }),
    );

    expect(response.status).toBe(201);
    const { data } = mocks.driverCreate.mock.calls[0][0];
    expect(data).toMatchObject({
      bankAccountName: null,
      bankAccountNumber: null,
      bankBsb: null,
    });
  });

  it("saves bank details sent by an admin", async () => {
    const response = await updateDriver(
      jsonRequest({ method: "PUT", body: { bankBsb: "654321" } }),
      context,
    );

    expect(response.status).toBe(200);
    const { data } = mocks.driverUpdate.mock.calls[0][0];
    expect(data).toMatchObject({ bankBsb: "654321" });
    expect(await response.json()).toMatchObject({ bankBsb: "654321" });
  });
});
