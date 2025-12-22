/**
 * @jest-environment node
 *
 * Simplified integration tests for API CRUD operations
 * Tests API route handlers with mocked Prisma client
 */

import { NextRequest } from "next/server";

// Mock Prisma client - must be before importing routes
const mockJob = {
  id: 1,
  date: new Date("2024-01-15"),
  driver: "John Driver",
  customer: "Test Customer",
  billTo: "Test Bill To",
  truckType: "Truck",
  registration: "ABC123",
  pickup: "Test Pickup",
  dropoff: "Test Dropoff",
  runsheet: false,
  invoiced: false,
  chargedHours: 8,
  driverCharge: 200,
  startTime: new Date("2024-01-15T08:00:00Z"),
  finishTime: new Date("2024-01-15T16:00:00Z"),
  comments: "Test comments",
  jobReference: "JOB001",
  eastlink: 0,
  citylink: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCustomer = {
  id: 1,
  customer: "Integration Test Customer",
  billTo: "Integration Test Bill To",
  contact: "test@example.com",
  tray: 150,
  crane: 200,
  semi: 300,
  semiCrane: 400,
  fuelLevy: 25,
  tolls: true,
  breakDeduction: 30,
  comments: "Test customer comments",
  createdAt: new Date(),
  updatedAt: new Date(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    jobs: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    customer: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

// Import prisma after mocking
import { prisma } from "@/lib/prisma";

// Pre-import all route handlers
import * as JobsRoute from "@/app/api/jobs/route";
import * as JobsIdRoute from "@/app/api/jobs/[id]/route";
import * as CustomersRoute from "@/app/api/customers/route";

// Mock Clerk authentication
jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(() => ({
    userId: "test-user-123",
  })),
  clerkClient: jest.fn(() =>
    Promise.resolve({
      users: {
        getUser: jest.fn().mockResolvedValue({
          primaryEmailAddressId: "email-1",
          emailAddresses: [
            {
              id: "email-1",
              emailAddress: "test@example.com",
            },
          ],
        }),
      },
    }),
  ),
}));

// Mock rate limiter
jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({
    success: true,
    headers: {},
  }),
  rateLimitConfigs: {
    general: {},
  },
}));

// Mock user role
jest.mock("@/lib/permissions", () => ({
  getUserRole: jest.fn(() => Promise.resolve("admin")),
}));

// Mock activity logger
jest.mock("@/lib/activity-logger", () => ({
  logActivity: jest.fn().mockResolvedValue(undefined),
}));

// Helper function to make HTTP-like requests to our API handlers
async function makeRequest({
  method,
  path,
  body,
}: {
  method: string;
  path: string;
  body?: Record<string, unknown> | unknown[];
}) {
  const url = `http://localhost:3000${path}`;
  const headers = new Headers({
    "Content-Type": "application/json",
  });

  const requestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  const request = new NextRequest(url, requestInit);

  // Use pre-imported handlers
  if (path.startsWith("/api/jobs/") && path !== "/api/jobs") {
    const id = path.split("/").pop()!;
    const params = Promise.resolve({ id });

    switch (method) {
      case "GET":
        return await JobsIdRoute.GET(request, { params });
      case "PUT":
        return await JobsIdRoute.PUT(request, { params });
      case "DELETE":
        return await JobsIdRoute.DELETE(request, { params });
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  } else if (path === "/api/jobs") {
    switch (method) {
      case "GET":
        return await JobsRoute.GET(request);
      case "POST":
        return await JobsRoute.POST(request);
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  } else if (path === "/api/customers") {
    switch (method) {
      case "GET":
        return await CustomersRoute.GET(request);
      case "POST":
        return await CustomersRoute.POST(request);
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }

  throw new Error(`Unsupported path: ${path}`);
}

// Test data
const validJobData = {
  date: "2024-01-15",
  driver: "John Driver",
  customer: "Test Customer",
  billTo: "Test Bill To",
  truckType: "Truck",
  registration: "ABC123",
  pickup: "Test Pickup",
  dropoff: "Test Dropoff",
  runsheet: false,
  invoiced: false,
  chargedHours: 8,
  driverCharge: 200,
  startTime: "2024-01-15T08:00:00Z",
  finishTime: "2024-01-15T16:00:00Z",
  comments: "Test comments",
  jobReference: "JOB001",
  eastlink: 0,
  citylink: 0,
};

const validCustomerData = {
  customer: "Integration Test Customer",
  billTo: "Integration Test Bill To",
  contact: "test@example.com",
  tray: 150,
  crane: 200,
  semi: 300,
  semiCrane: 400,
  fuelLevy: 25,
  tolls: true,
  breakDeduction: 30,
  comments: "Test customer comments",
};

describe("API Integration Tests - HTTP Style", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Jobs API", () => {
    test("should create a new job with valid data", async () => {
      (prisma.jobs.create as jest.Mock).mockResolvedValue({
        ...mockJob,
        id: 1,
      });

      const response = await makeRequest({
        method: "POST",
        path: "/api/jobs",
        body: validJobData,
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        driver: "John Driver",
        customer: "Test Customer",
        billTo: "Test Bill To",
        chargedHours: 8,
        driverCharge: 200,
      });
      expect(data.id).toBeDefined();
    });

    test("should list all jobs", async () => {
      (prisma.jobs.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockJob,
          driver: "List Test Driver",
          customer: "List Test Customer",
        },
      ]);

      const response = await makeRequest({ method: "GET", path: "/api/jobs" });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty("id");
      expect(data[0]).toHaveProperty("driver");
    });

    test("should get job by ID", async () => {
      (prisma.jobs.findUnique as jest.Mock).mockResolvedValue({
        ...mockJob,
        id: 1,
        driver: "Get Test Driver",
      });

      const response = await makeRequest({
        method: "GET",
        path: "/api/jobs/1",
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(1);
      expect(data.driver).toBe("Get Test Driver");
    });

    test("should update job by ID", async () => {
      (prisma.jobs.update as jest.Mock).mockResolvedValue({
        ...mockJob,
        driver: "Updated Driver Name",
        chargedHours: 9,
        driverCharge: 225,
      });

      const updateData = {
        driver: "Updated Driver Name",
        chargedHours: 9,
        driverCharge: 225,
      };

      const response = await makeRequest({
        method: "PUT",
        path: "/api/jobs/1",
        body: updateData,
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.driver).toBe("Updated Driver Name");
      expect(data.chargedHours).toBe(9);
      expect(data.driverCharge).toBe(225);
    });

    test("should delete job by ID (admin user)", async () => {
      (prisma.jobs.delete as jest.Mock).mockResolvedValue(mockJob);

      const response = await makeRequest({
        method: "DELETE",
        path: "/api/jobs/1",
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.jobs.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    test("should return 404 for non-existent job ID", async () => {
      (prisma.jobs.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await makeRequest({
        method: "GET",
        path: "/api/jobs/999999999",
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Not found");
    });

    test("should return 400 for invalid ID parameter", async () => {
      const response = await makeRequest({
        method: "GET",
        path: "/api/jobs/invalid-id",
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid ID parameter");
    });
  });

  describe("Customers API", () => {
    test("should create a new customer with valid data", async () => {
      (prisma.customer.create as jest.Mock).mockResolvedValue({
        ...mockCustomer,
        id: 1,
      });

      const response = await makeRequest({
        method: "POST",
        path: "/api/customers",
        body: validCustomerData,
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        customer: "Integration Test Customer",
        billTo: "Integration Test Bill To",
        contact: "test@example.com",
        tray: 150,
        crane: 200,
        tolls: true,
      });
      expect(data.id).toBeDefined();
    });

    test("should list all customers", async () => {
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockCustomer,
          customer: "List Integration Customer",
        },
      ]);

      const response = await makeRequest({
        method: "GET",
        path: "/api/customers",
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty("id");
      expect(data[0]).toHaveProperty("customer");
    });
  });
});
