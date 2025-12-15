/**
 * @jest-environment node
 *
 * Simplified integration tests for API CRUD operations
 * Tests actual HTTP requests instead of direct function calls
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Pre-import all route handlers to avoid dynamic import overhead
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
async function makeRequest(
  method: string,
  path: string,
  body?: Record<string, unknown> | unknown[],
) {
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

  // Use pre-imported handlers instead of dynamic imports
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
  // Clean up test data
  beforeEach(async () => {
    await prisma.jobs.deleteMany({
      where: { customer: { contains: "Test Customer" } },
    });
    await prisma.customer.deleteMany({
      where: { customer: { contains: "Integration Test" } },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("Jobs API", () => {
    test("should create a new job with valid data", async () => {
      const response = await makeRequest("POST", "/api/jobs", validJobData);
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
      // Create test job first
      await prisma.jobs.create({
        data: {
          date: new Date("2024-01-15"),
          driver: "List Test Driver",
          customer: "List Test Customer",
          billTo: "List Test Bill To",
          truckType: "Truck",
          registration: "LIST123",
          pickup: "Test Pickup",
          runsheet: false,
          invoiced: false,
          chargedHours: 6,
          driverCharge: 150,
        },
      });

      const response = await makeRequest("GET", "/api/jobs");
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty("id");
      expect(data[0]).toHaveProperty("driver");
    });

    test("should get job by ID", async () => {
      // Create test job
      const job = await prisma.jobs.create({
        data: {
          date: new Date("2024-01-15"),
          driver: "Get Test Driver",
          customer: "Get Test Customer",
          billTo: "Get Test Bill To",
          truckType: "Truck",
          registration: "GET123",
          pickup: "Test Pickup",
          runsheet: false,
          invoiced: false,
          chargedHours: 7,
          driverCharge: 175,
        },
      });

      const response = await makeRequest("GET", `/api/jobs/${job.id}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(job.id);
      expect(data.driver).toBe("Get Test Driver");
    });

    test("should update job by ID", async () => {
      // Create test job
      const job = await prisma.jobs.create({
        data: {
          date: new Date("2024-01-15"),
          driver: "Update Test Driver",
          customer: "Update Test Customer",
          billTo: "Update Test Bill To",
          truckType: "Truck",
          registration: "UPD123",
          pickup: "Test Pickup",
          runsheet: false,
          invoiced: false,
          chargedHours: 5,
          driverCharge: 125,
        },
      });

      const updateData = {
        driver: "Updated Driver Name",
        chargedHours: 9,
        driverCharge: 225,
      };

      const response = await makeRequest(
        "PUT",
        `/api/jobs/${job.id}`,
        updateData,
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.driver).toBe("Updated Driver Name");
      expect(data.chargedHours).toBe(9);
      expect(data.driverCharge).toBe(225);
    });

    test("should delete job by ID (admin user)", async () => {
      // Create test job
      const job = await prisma.jobs.create({
        data: {
          date: new Date("2024-01-15"),
          driver: "Delete Test Driver",
          customer: "Delete Test Customer",
          billTo: "Delete Test Bill To",
          truckType: "Truck",
          registration: "DEL123",
          pickup: "Test Pickup",
          runsheet: false,
          invoiced: false,
          chargedHours: 4,
          driverCharge: 100,
        },
      });

      const response = await makeRequest("DELETE", `/api/jobs/${job.id}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify job was deleted
      const deletedJob = await prisma.jobs.findUnique({
        where: { id: job.id },
      });
      expect(deletedJob).toBeNull();
    });

    test("should return 404 for non-existent job ID", async () => {
      const response = await makeRequest("GET", "/api/jobs/999999999");
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Not found");
    });

    test("should return 400 for invalid ID parameter", async () => {
      const response = await makeRequest("GET", "/api/jobs/invalid-id");
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid ID parameter");
    });
  });

  describe("Customers API", () => {
    test("should create a new customer with valid data", async () => {
      const response = await makeRequest(
        "POST",
        "/api/customers",
        validCustomerData,
      );
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

      // Clean up created customer
      await prisma.customer.delete({
        where: { id: data.id },
      });
    });

    test("should list all customers", async () => {
      // Create test customer first
      const testCustomer = await prisma.customer.create({
        data: {
          customer: "List Integration Customer",
          billTo: "List Integration Bill To",
          contact: "list@example.com",
          tray: 100,
          tolls: false,
        },
      });

      const response = await makeRequest("GET", "/api/customers");
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty("id");
      expect(data[0]).toHaveProperty("customer");

      // Clean up created customer
      await prisma.customer.delete({
        where: { id: testCustomer.id },
      });
    });
  });
});
