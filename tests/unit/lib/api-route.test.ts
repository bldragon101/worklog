/**
 * @vitest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  apiRoute,
  handlePrismaWriteError,
  idParams,
  positiveIntParam,
  withRateLimitHeaders,
} from "@/lib/api-route";

const RATE_LIMIT_HEADERS = {
  "X-RateLimit-Limit": "150",
  "X-RateLimit-Remaining": "149",
};

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  createRateLimiter: vi.fn(),
  requireAuth: vi.fn(),
  requireAuthWithPermission: vi.fn(),
  checkPermission: vi.fn(),
  getUserRole: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: mocks.createRateLimiter,
  rateLimitConfigs: {
    general: { maxRequests: 150 },
    upload: { maxRequests: 10 },
  },
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.requireAuth,
  requireAuthWithPermission: mocks.requireAuthWithPermission,
}));
vi.mock("@/lib/permissions", () => ({
  checkPermission: mocks.checkPermission,
  getUserRole: mocks.getUserRole,
}));

function buildRequest() {
  return new NextRequest("http://localhost/api/things/5");
}

function withParams({ params }: { params: Record<string, string> }) {
  return { params: Promise.resolve(params) };
}

function unauthorised() {
  return NextResponse.json(
    { error: "Unauthorized - Authentication required" },
    { status: 401 },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createRateLimiter.mockReturnValue(mocks.rateLimit);
  mocks.rateLimit.mockReturnValue({ headers: RATE_LIMIT_HEADERS });
  mocks.requireAuth.mockResolvedValue({ userId: "user_1" });
  mocks.requireAuthWithPermission.mockResolvedValue({ userId: "user_1" });
  mocks.checkPermission.mockResolvedValue(true);
  mocks.getUserRole.mockResolvedValue("admin");
});

function expectRateLimitHeaders({ response }: { response: Response }) {
  expect(response.headers.get("X-RateLimit-Limit")).toBe("150");
  expect(response.headers.get("X-RateLimit-Remaining")).toBe("149");
}

describe("apiRoute rate limiting", () => {
  it("creates one limiter per route from the named config", () => {
    apiRoute({
      rateLimit: "upload",
      auth: "public",
      errorMessage: "Error",
      handler: async () => NextResponse.json({}),
    });

    expect(mocks.createRateLimiter).toHaveBeenCalledTimes(1);
    expect(mocks.createRateLimiter).toHaveBeenCalledWith({ maxRequests: 10 });
  });

  it("uses the general config by default", () => {
    apiRoute({
      auth: "public",
      errorMessage: "Error",
      handler: async () => NextResponse.json({}),
    });

    expect(mocks.createRateLimiter).toHaveBeenCalledWith({ maxRequests: 150 });
  });

  it("returns the limiter's 429 response without authenticating", async () => {
    const tooMany = NextResponse.json(
      { error: "Too many requests" },
      { status: 429 },
    );
    mocks.rateLimit.mockReturnValue(tooMany);
    const handler = vi.fn();
    const route = apiRoute({ auth: "user", errorMessage: "Error", handler });

    const response = await route(buildRequest());

    expect(response).toBe(tooMany);
    expect(mocks.requireAuth).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("adds rate-limit headers to a handler response that lacks them", async () => {
    const route = apiRoute({
      auth: "user",
      errorMessage: "Error",
      handler: async () => NextResponse.json({ ok: true }, { status: 201 }),
    });

    const response = await route(buildRequest());

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expectRateLimitHeaders({ response });
  });

  it("keeps headers the handler already set", async () => {
    const route = apiRoute({
      auth: "user",
      errorMessage: "Error",
      handler: async () =>
        NextResponse.json({}, { headers: { "X-RateLimit-Remaining": "7" } }),
    });

    const response = await route(buildRequest());

    expect(response.headers.get("X-RateLimit-Remaining")).toBe("7");
    expect(response.headers.get("X-RateLimit-Limit")).toBe("150");
  });

  it("copies a response whose headers cannot be changed", async () => {
    const route = apiRoute({
      auth: "user",
      errorMessage: "Error",
      handler: async () => Response.redirect("http://localhost/done", 302),
    });

    const response = await route(buildRequest());

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("http://localhost/done");
    expectRateLimitHeaders({ response });
  });
});

describe("apiRoute auth", () => {
  it("passes a null userId for public routes without authenticating", async () => {
    const handler = vi.fn(async () => NextResponse.json({}));
    const route = apiRoute({ auth: "public", errorMessage: "Error", handler });

    await route(buildRequest());

    expect(mocks.requireAuth).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null }),
    );
  });

  it("returns a 401 with rate-limit headers when signed out", async () => {
    mocks.requireAuth.mockResolvedValue(unauthorised());
    const handler = vi.fn();
    const route = apiRoute({ auth: "user", errorMessage: "Error", handler });

    const response = await route(buildRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Unauthorized - Authentication required",
    });
    expectRateLimitHeaders({ response });
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes the signed-in user to the handler", async () => {
    const handler = vi.fn(async () => NextResponse.json({}));
    const route = apiRoute({ auth: "user", errorMessage: "Error", handler });
    const request = buildRequest();

    await route(request);

    expect(handler).toHaveBeenCalledWith({
      userId: "user_1",
      request,
      params: {},
      headers: RATE_LIMIT_HEADERS,
    });
  });

  it("checks a permission with the shared guard by default", async () => {
    mocks.requireAuthWithPermission.mockResolvedValue(
      NextResponse.json(
        { error: "Forbidden - Insufficient permissions" },
        { status: 403 },
      ),
    );
    const route = apiRoute({
      auth: { permission: "manage_jobs_report" },
      errorMessage: "Error",
      handler: vi.fn(),
    });

    const response = await route(buildRequest());

    expect(response.status).toBe(403);
    expectRateLimitHeaders({ response });
    expect(mocks.requireAuthWithPermission).toHaveBeenCalledWith({
      permission: "manage_jobs_report",
      headers: RATE_LIMIT_HEADERS,
    });
  });

  it("uses a custom forbidden message for a permission", async () => {
    mocks.checkPermission.mockResolvedValue(false);
    const route = apiRoute({
      auth: {
        permission: "manage_users",
        forbiddenMessage: "Forbidden - User management permission required",
      },
      errorMessage: "Error",
      handler: vi.fn(),
    });

    const response = await route(buildRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Forbidden - User management permission required",
    });
    expectRateLimitHeaders({ response });
    expect(mocks.checkPermission).toHaveBeenCalledWith("manage_users");
  });

  it("does not check the permission of a signed-out user", async () => {
    mocks.requireAuth.mockResolvedValue(unauthorised());
    const route = apiRoute({
      auth: { permission: "manage_users", forbiddenMessage: "Forbidden" },
      errorMessage: "Error",
      handler: vi.fn(),
    });

    const response = await route(buildRequest());

    expect(response.status).toBe(401);
    expect(mocks.checkPermission).not.toHaveBeenCalled();
  });

  it("rejects a role outside the allowed roles", async () => {
    mocks.getUserRole.mockResolvedValue("manager");
    const route = apiRoute({
      auth: {
        roles: ["admin"],
        forbiddenMessage: "Forbidden - Admin privileges required",
      },
      errorMessage: "Error",
      handler: vi.fn(),
    });

    const response = await route(buildRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Forbidden - Admin privileges required",
    });
    expectRateLimitHeaders({ response });
    expect(mocks.getUserRole).toHaveBeenCalledWith("user_1");
  });

  it("passes the role of an allowed user to the handler", async () => {
    const handler = vi.fn(async () => NextResponse.json({}));
    const route = apiRoute({
      auth: { roles: ["admin"], forbiddenMessage: "Forbidden" },
      errorMessage: "Error",
      handler,
    });

    await route(buildRequest());

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_1", userRole: "admin" }),
    );
  });

  it("runs a custom guard with the rate-limit headers", async () => {
    const guard = vi.fn(async () => ({
      userId: "user_2",
      isValidAdmin: true,
    }));
    const handler = vi.fn(async () => NextResponse.json({}));
    const route = apiRoute({ auth: guard, errorMessage: "Error", handler });

    await route(buildRequest());

    expect(guard).toHaveBeenCalledWith({ headers: RATE_LIMIT_HEADERS });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_2", isValidAdmin: true }),
    );
  });

  it("returns a custom guard's response with rate-limit headers", async () => {
    const route = apiRoute({
      auth: async () => NextResponse.json({ error: "No" }, { status: 403 }),
      errorMessage: "Error",
      handler: vi.fn(),
    });

    const response = await route(buildRequest());

    expect(response.status).toBe(403);
    expectRateLimitHeaders({ response });
  });
});

describe("apiRoute params", () => {
  it("passes the raw params when there is no schema", async () => {
    const handler = vi.fn(async () => NextResponse.json({}));
    const route = apiRoute({ auth: "user", errorMessage: "Error", handler });

    await route(buildRequest(), withParams({ params: { slug: "abc" } }));

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ params: { slug: "abc" } }),
    );
  });

  it("parses a numeric id", async () => {
    const handler = vi.fn(async () => NextResponse.json({}));
    const route = apiRoute({
      auth: "user",
      params: idParams({ message: "Invalid RCTI ID" }),
      errorMessage: "Error",
      handler,
    });

    await route(buildRequest(), withParams({ params: { id: "42" } }));

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: 42 } }),
    );
  });

  it.each(["abc", "12abc", "0", "-1", "1.5", ""])(
    "rejects the id %j with the route's message and rate-limit headers",
    async (id) => {
      const handler = vi.fn();
      const route = apiRoute({
        auth: "user",
        params: idParams({ message: "Invalid RCTI ID" }),
        errorMessage: "Error",
        handler,
      });

      const response = await route(
        buildRequest(),
        withParams({ params: { id } }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid RCTI ID" });
      expectRateLimitHeaders({ response });
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it("validates params only after authenticating", async () => {
    mocks.requireAuth.mockResolvedValue(unauthorised());
    const route = apiRoute({
      auth: "user",
      params: idParams(),
      errorMessage: "Error",
      handler: vi.fn(),
    });

    const response = await route(
      buildRequest(),
      withParams({ params: { id: "abc" } }),
    );

    expect(response.status).toBe(401);
  });

  it("reports the first failing param of a multi-param schema", async () => {
    const route = apiRoute({
      auth: "user",
      params: z.object({
        id: positiveIntParam({ message: "Invalid RCTI ID" }),
        lineId: positiveIntParam({ message: "Invalid line ID" }),
      }),
      errorMessage: "Error",
      handler: vi.fn(),
    });

    const response = await route(
      buildRequest(),
      withParams({ params: { id: "3", lineId: "x" } }),
    );

    expect(await response.json()).toEqual({ error: "Invalid line ID" });
  });

  it("defaults the id message", async () => {
    const result = idParams().safeParse({ id: "x" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Invalid ID");
  });
});

describe("apiRoute errors", () => {
  it("responds with a thrown ApiError's status, message and body", async () => {
    const route = apiRoute({
      auth: "user",
      errorMessage: "Error",
      handler: async () => {
        throw new ApiError({
          status: 404,
          message: "RCTI not found",
          body: { success: false },
        });
      },
    });

    const response = await route(buildRequest());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      error: "RCTI not found",
    });
    expectRateLimitHeaders({ response });
  });

  it("treats a thrown ZodError as unexpected without a validation message", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const route = apiRoute({
      auth: "user",
      errorMessage: "Error",
      handler: async () => {
        z.object({ name: z.string() }).parse({});
        return NextResponse.json({});
      },
    });

    const response = await route(buildRequest());

    expect(response.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it("responds 400 to a thrown ZodError", async () => {
    const route = apiRoute({
      auth: "user",
      errorMessage: "Error",
      validationMessage: "Invalid request data",
      handler: async () => {
        z.object({ name: z.string() }).parse({});
        return NextResponse.json({});
      },
    });

    const response = await route(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid request data");
    expect(body.details[0].path).toEqual(["name"]);
    expectRateLimitHeaders({ response });
  });

  it("uses the route's validation message and error body fields", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = ({ error }: { error: Error }) =>
      apiRoute({
        auth: "user",
        errorMessage: "Error",
        validationMessage: "Invalid input data",
        errorBody: { success: false },
        handler: async () => {
          throw error;
        },
      });
    let zodError = new Error("placeholder");
    try {
      z.object({ name: z.string() }).parse({});
    } catch (error) {
      zodError = error as Error;
    }

    const invalid = await failing({ error: zodError })(buildRequest());
    const failed = await failing({ error: new Error("boom") })(buildRequest());

    expect(await invalid.json()).toMatchObject({
      success: false,
      error: "Invalid input data",
    });
    expect(await failed.json()).toEqual({
      success: false,
      error: "Internal server error",
    });
    consoleSpy.mockRestore();
  });

  it("responds 409 to a unique constraint violation", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const route = apiRoute({
      auth: "user",
      errorMessage: "Error creating customer",
      conflictResource: "customer",
      handler: async () => {
        throw Object.assign(new Error("Unique"), {
          code: "P2002",
          meta: { target: ["customer"] },
        });
      },
    });

    const response = await route(buildRequest());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error:
        "A customer with these details already exists. The value for 'customer' is already in use.",
    });
    expectRateLimitHeaders({ response });
    consoleSpy.mockRestore();
  });

  it("logs an unexpected error and responds with the generic message", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("Connection lost: postgres://secret");
    const route = apiRoute({
      auth: "user",
      errorMessage: "Error marking RCTI as paid",
      responseMessage: "Failed to mark RCTI as paid",
      handler: async () => {
        throw failure;
      },
    });

    const response = await route(buildRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to mark RCTI as paid",
    });
    expectRateLimitHeaders({ response });
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error marking RCTI as paid:",
      failure,
    );
    consoleSpy.mockRestore();
  });

  it("logs only the message when asked to", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const route = apiRoute({
      auth: "user",
      errorMessage: "Error updating settings",
      logErrorMessageOnly: true,
      handler: async () => {
        throw new Error("boom");
      },
    });

    await route(buildRequest());

    expect(consoleSpy).toHaveBeenCalledWith("Error updating settings:", "boom");
    consoleSpy.mockRestore();
  });

  it("defaults the 500 message", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const route = apiRoute({
      auth: "user",
      errorMessage: "Error",
      handler: async () => {
        throw new Error("boom");
      },
    });

    const response = await route(buildRequest());

    expect(await response.json()).toEqual({ error: "Internal server error" });
    consoleSpy.mockRestore();
  });

  it("responds 500 when the auth guard itself fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.requireAuth.mockRejectedValue(new Error("Database unavailable"));
    const route = apiRoute({
      auth: "user",
      errorMessage: "Error",
      handler: vi.fn(),
    });

    const response = await route(buildRequest());

    expect(response.status).toBe(500);
    expectRateLimitHeaders({ response });
    consoleSpy.mockRestore();
  });
});

describe("handlePrismaWriteError", () => {
  it("ignores other errors", () => {
    expect(
      handlePrismaWriteError({ error: new Error("x"), resourceType: "job" }),
    ).toBeNull();
    expect(
      handlePrismaWriteError({ error: { code: "P2025" }, resourceType: "job" }),
    ).toBeNull();
  });

  it("omits the field detail when the target is unknown", async () => {
    const response = handlePrismaWriteError({
      error: { code: "P2002" },
      resourceType: "vehicle",
    });

    expect(response?.status).toBe(409);
    expect(await response?.json()).toEqual({
      error: "A vehicle with these details already exists.",
    });
  });
});

describe("withRateLimitHeaders", () => {
  it("returns the same response when nothing is missing", () => {
    const response = NextResponse.json({}, { headers: RATE_LIMIT_HEADERS });

    expect(
      withRateLimitHeaders({ response, headers: RATE_LIMIT_HEADERS }),
    ).toBe(response);
  });
});
