import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireAuth, requireAuthWithPermission } from "@/lib/auth";
import {
  checkPermission,
  getUserRole,
  type PagePermission,
  type UserRole,
} from "@/lib/permissions";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { ApiError } from "@/lib/api-error";

export { ApiError };

export type RateLimitName = keyof typeof rateLimitConfigs;

export type RateLimitHeaders = Record<string, string>;

/**
 * A custom guard for routes whose access rule is not a single permission or
 * role check. Returns a response to send as-is, or the signed-in user.
 */
export type AuthGuard = (args: {
  headers: RateLimitHeaders;
}) => Promise<Response | { userId: string }>;

/**
 * Who may call a route:
 * - "public": no sign-in required (userId is null)
 * - "user": any signed-in, active user
 * - { permission }: a user whose role has the permission; with
 *   forbiddenMessage the 403 uses that text instead of the default
 * - { roles, forbiddenMessage }: a user whose role is one of the roles
 * - a guard function for anything else
 */
export type ApiRouteAuth =
  | "public"
  | "user"
  | { permission: PagePermission; forbiddenMessage?: string }
  | { roles: readonly UserRole[]; forbiddenMessage: string }
  | AuthGuard;

type RawParams = Record<string, string | string[] | undefined>;

/** The second argument Next.js passes to a route handler */
export type RouteContext = { params: Promise<RawParams> };

type AuthContext<A extends ApiRouteAuth> = A extends "public"
  ? { userId: null }
  : A extends AuthGuard
    ? Exclude<Awaited<ReturnType<A>>, Response>
    : A extends { roles: readonly UserRole[] }
      ? { userId: string; userRole: UserRole }
      : { userId: string };

type ParsedParams<S> = S extends z.ZodType ? z.output<S> : RawParams;

export type ApiRouteContext<
  A extends ApiRouteAuth,
  S extends z.ZodType | undefined = undefined,
> = {
  request: NextRequest;
  params: ParsedParams<S>;
  /** Rate-limit headers; the wrapper also adds them to the handler's response */
  headers: RateLimitHeaders;
} & AuthContext<A>;

export type ApiRouteOptions<
  A extends ApiRouteAuth,
  S extends z.ZodType | undefined = undefined,
> = {
  /** Key of rateLimitConfigs, "general" by default */
  rateLimit?: RateLimitName;
  auth: A;
  /** Schema for the route params; a failure responds 400 with its first issue */
  params?: S;
  /** Logged with the error when the handler fails unexpectedly */
  errorMessage: string;
  /** Body text of the 500 response, "Internal server error" by default */
  responseMessage?: string;
  /** Resource named in the 409 response for a unique constraint violation */
  conflictResource?: string;
  handler: (context: ApiRouteContext<A, S>) => Promise<Response>;
};

/**
 * A route param that must be a positive integer, parsed to a number. Every
 * failure uses the given message.
 */
export function positiveIntParam({ message }: { message: string }) {
  return z
    .string({ error: message })
    .regex(/^\d+$/, { error: message })
    .transform(Number)
    .refine((value) => Number.isSafeInteger(value) && value > 0, {
      error: message,
    });
}

/** Params schema for routes with a single numeric `[id]` segment */
export function idParams({
  message = "Invalid ID",
}: { message?: string } = {}) {
  return z.object({ id: positiveIntParam({ message }) });
}

/**
 * Maps a Prisma unique constraint violation (P2002) to a 409 Conflict naming
 * the offending field(s).
 * @returns A response when the error is recognised, otherwise null.
 */
export function handlePrismaWriteError({
  error,
  resourceType,
}: {
  error: unknown;
  resourceType: string;
}): NextResponse | null {
  if (
    typeof error !== "object" ||
    error === null ||
    (error as { code?: unknown }).code !== "P2002"
  ) {
    return null;
  }

  const target = (error as { meta?: { target?: string[] | string } }).meta
    ?.target;
  const fields = Array.isArray(target) ? target.join(", ") : target;
  const detail = fields ? ` The value for '${fields}' is already in use.` : "";

  return NextResponse.json(
    { error: `A ${resourceType} with these details already exists.${detail}` },
    { status: 409 },
  );
}

/**
 * Adds any rate-limit headers the response does not already carry. A
 * response with immutable headers is copied first.
 */
export function withRateLimitHeaders({
  response,
  headers,
}: {
  response: Response;
  headers: RateLimitHeaders;
}): Response {
  const missing = [...new Headers(headers)].filter(
    ([key]) => !response.headers.has(key),
  );
  if (missing.length === 0) return response;

  try {
    for (const [key, value] of missing) response.headers.set(key, value);
    return response;
  } catch {
    const copy = new Response(response.body, response);
    for (const [key, value] of missing) copy.headers.set(key, value);
    return copy;
  }
}

function forbidden({ message }: { message: string }) {
  return NextResponse.json({ error: message }, { status: 403 });
}

async function authenticate({
  auth,
  headers,
}: {
  auth: ApiRouteAuth;
  headers: RateLimitHeaders;
}): Promise<Response | { userId: string | null; userRole?: UserRole }> {
  if (auth === "public") return { userId: null };
  if (auth === "user") return requireAuth();
  if (typeof auth === "function") return auth({ headers });

  if ("roles" in auth) {
    const authResult = await requireAuth();
    if (authResult instanceof Response) return authResult;

    const userRole = await getUserRole(authResult.userId);
    if (!auth.roles.includes(userRole)) {
      return forbidden({ message: auth.forbiddenMessage });
    }
    return { userId: authResult.userId, userRole };
  }

  if (auth.forbiddenMessage === undefined) {
    return requireAuthWithPermission({ permission: auth.permission, headers });
  }

  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;

  if (!(await checkPermission(auth.permission))) {
    return forbidden({ message: auth.forbiddenMessage });
  }
  return authResult;
}

function errorResponse({
  error,
  errorMessage,
  responseMessage,
  conflictResource,
}: {
  error: unknown;
  errorMessage: string;
  responseMessage: string;
  conflictResource: string;
}): Response {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { ...error.body, error: error.message },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request data", details: error.issues },
      { status: 400 },
    );
  }

  console.error(`${errorMessage}:`, error);

  const conflict = handlePrismaWriteError({
    error,
    resourceType: conflictResource,
  });
  if (conflict) return conflict;

  return NextResponse.json({ error: responseMessage }, { status: 500 });
}

/**
 * Builds a Next.js route handler that applies, in order: rate limiting, the
 * auth guard, route-param validation, then the handler. Rate-limit headers
 * are added to every response, including auth, param and error failures.
 *
 * Errors thrown by the handler map to responses: ApiError to its status,
 * ZodError to 400, a Prisma unique constraint violation to 409, and anything
 * else is logged with `errorMessage` and answered with a generic 500.
 */
export function apiRoute<
  const A extends ApiRouteAuth,
  S extends z.ZodType | undefined = undefined,
>({
  rateLimit = "general",
  auth,
  params: paramsSchema,
  errorMessage,
  responseMessage = "Internal server error",
  conflictResource = "record",
  handler,
}: ApiRouteOptions<A, S>) {
  const limit = createRateLimiter(rateLimitConfigs[rateLimit]);

  return async function route(
    request: NextRequest,
    context?: RouteContext,
  ): Promise<Response> {
    const rateLimitResult = limit(request);
    if (rateLimitResult instanceof Response) return rateLimitResult;

    const headers: RateLimitHeaders = rateLimitResult.headers;
    const respond = (response: Response) =>
      withRateLimitHeaders({ response, headers });

    try {
      const authResult = await authenticate({ auth, headers });
      if (authResult instanceof Response) return respond(authResult);

      const rawParams: RawParams = context ? await context.params : {};
      let params: unknown = rawParams;
      if (paramsSchema) {
        const parsed = paramsSchema.safeParse(rawParams);
        if (!parsed.success) {
          return respond(
            NextResponse.json(
              {
                error: parsed.error.issues[0]?.message ?? "Invalid parameters",
              },
              { status: 400 },
            ),
          );
        }
        params = parsed.data;
      }

      const response = await handler({
        ...authResult,
        request,
        params,
        headers,
      } as ApiRouteContext<A, S>);
      return respond(response);
    } catch (error) {
      return respond(
        errorResponse({
          error,
          errorMessage,
          responseMessage,
          conflictResource,
        }),
      );
    }
  };
}
