import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserRole } from '@/lib/permissions';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';
import { validateRequestBody, idParamSchema } from '@/lib/validation';
import { secureWriteOperation, sanitizeWriteData } from '@/lib/write-security';
import { prisma } from '@/lib/prisma';

export { prisma };
import { JobsActivityLogger, CustomerActivityLogger, DriverActivityLogger, VehicleActivityLogger } from '@/lib/activity-logger';
import { z } from 'zod';
const rateLimit = createRateLimiter(rateLimitConfigs.general);


/**
 * API protection wrapper that handles rate limiting and authentication
 * @param request - The incoming NextRequest
 * @returns Object with either error response or success data with headers and userId
 */
export async function withApiProtection(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) {
    return { error: rateLimitResult };
  }

  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return { error: authResult };
  }

  return { 
    success: true, 
    headers: rateLimitResult.headers,
    userId: authResult.userId 
  };
}

/**
 * Generic API response wrapper with standardized error handling
 * @param operation - Async operation to execute
 * @param errorMessage - Error message to log on failure
 * @returns Function that executes the operation with error handling
 */
export function withErrorHandling<T>(
  operation: () => Promise<T>, 
  errorMessage: string
) {
  return async (protection: { headers?: Record<string, string> }) => {
    try {
      const result = await operation();
      return NextResponse.json(result, {
        headers: protection.headers
      });
    } catch (error) {
      console.error(errorMessage, error);
      
      // Handle custom error codes (like 404)
      if (error instanceof Error && (error as Error & { statusCode?: number }).statusCode) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode!;
        return NextResponse.json(
          { error: error.message }, 
          { status: statusCode, headers: protection.headers }
        );
      }
      
      return NextResponse.json(
        { error: 'Internal server error' }, 
        { status: 500, headers: protection.headers }
      );
    }
  };
}

/**
 * Generic find by ID operation for Prisma models
 * @param model - Prisma model instance
 * @param id - Record ID to find
 * @returns Promise resolving to the found record
 * @throws Error with statusCode 404 if record not found
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findById(model: any, id: number) {
  const record = await model.findUnique({ where: { id } });
  if (!record) {
    // Throw a special error that withErrorHandling can catch and convert to proper 404
    const error = new Error('Not found') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }
  return record;
}

/**
 * Generic delete by ID operation for Prisma models
 * @param model - Prisma model instance
 * @param id - Record ID to delete
 * @returns Promise resolving to success object
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deleteById(model: any, id: number) {
  await model.delete({ where: { id } });
  return { success: true };
}

/**
 * Generic list operation with optional ordering for Prisma models
 * @param model - Prisma model instance
 * @param orderBy - Optional ordering configuration, defaults to createdAt desc
 * @returns Promise resolving to array of records
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findMany(model: any, orderBy?: Record<string, string>) {
  return await model.findMany({
    orderBy: orderBy || { createdAt: 'desc' }
  });
}

/**
 * Validates ID parameter from route params
 * @param params - Promise containing route parameters with id
 * @returns Object with either error response or success data with parsed ID
 */
export async function validateIdParam(params: Promise<{ id: string }>) {
  const { id } = await params;
  const validationResult = idParamSchema.safeParse({ id });
  
  if (!validationResult.success) {
    return { error: NextResponse.json({ error: 'Invalid ID parameter' }, { status: 400 }) };
  }
  
  return { success: true, id: parseInt(id) };
}

/**
 * Validates and parses request body using Zod schema
 * @param request - The incoming NextRequest
 * @param schema - Zod schema for validation
 * @returns Object with either error response or success data with parsed body
 */
export async function validateAndParseBody<T>(
  request: NextRequest, 
  schema: z.ZodSchema<T>
) {
  const validationResult = await validateRequestBody(request, schema);
  if (!validationResult.success) {
    return { 
      error: NextResponse.json(
        { error: validationResult.error }, 
        { status: 400 }
      ) 
    };
  }
  
  return { success: true, data: validationResult.data };
}

/**
 * Gets appropriate activity logger based on resource type
 * @param resourceType - Type of resource (job, customer, driver, vehicle)
 * @returns Activity logger instance or null if not found
 */
function getActivityLogger(resourceType: string) {
  switch (resourceType) {
    case 'job': return JobsActivityLogger;
    case 'customer': return CustomerActivityLogger;
    case 'driver': return DriverActivityLogger;
    case 'vehicle': return VehicleActivityLogger;
    default: return null;
  }
}

/**
 * Creates standardized CRUD handlers for API routes with security, validation, and activity logging
 * @param config - Configuration object containing model, schemas, and optional hooks
 * @returns Object containing CRUD handler functions (list, create, getById, updateById, deleteById)
 */
export function createCrudHandlers<TCreate, TUpdate>(config: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any;
  createSchema: z.ZodSchema<TCreate>;
  updateSchema: z.ZodSchema<TUpdate>;
  resourceType: 'job' | 'customer' | 'vehicle' | 'driver' | 'general';
  createTransform?: (data: TCreate) => Record<string, unknown>;
  updateTransform?: (data: TUpdate) => Record<string, unknown>;
  listOrderBy?: Record<string, string>;
  beforeCreate?: (data: TCreate) => Promise<NextResponse | null>;
  beforeUpdate?: (id: number, data: TUpdate) => Promise<NextResponse | null>;
  beforeDelete?: (id: number) => Promise<NextResponse | null>;
}) {
  return {
    // GET /api/resource
    async list(request: NextRequest) {
      const protection = await withApiProtection(request);
      if (protection.error) return protection.error;

      return withErrorHandling(
        () => findMany(config.model, config.listOrderBy),
        `Error fetching ${config.model.name || 'records'}`
      )(protection);
    },

    // POST /api/resource
    async create(request: NextRequest) {
      // SECURITY: Use secure write operation with full validation
      const writeResult = await secureWriteOperation(request, {
        schema: config.createSchema,
        operation: 'create',
        resourceType: config.resourceType,
        requiresRole: 'user', // Minimum role for creation
      });

      if (!writeResult.success) {
        return writeResult.error;
      }

      const { data, userId } = writeResult;

      // Run before-create hook if provided
      if (config.beforeCreate) {
        const hookResult = await config.beforeCreate(data);
        if (hookResult) return hookResult;
      }

      // SECURITY: Sanitize data and apply transforms
      const sanitizedData = sanitizeWriteData(data as Record<string, unknown>, ['id', 'createdAt', 'updatedAt']);
      const createData = config.createTransform 
        ? config.createTransform(sanitizedData as TCreate)
        : sanitizedData;

      try {
        const result = await config.model.create({ data: createData });
        console.log(`SECURE CREATE: User ${userId} created ${config.resourceType} with ID ${result.id}`);
        
        // Log activity
        const logger = getActivityLogger(config.resourceType);
        if (logger) {
          await logger.logCreate(result, request);
        }
        
        return NextResponse.json(result, { status: 201 });
      } catch (error) {
        console.error(`Error creating ${config.resourceType}:`, error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },

    // GET /api/resource/[id]
    async getById(request: NextRequest, params: Promise<{ id: string }>) {
      const protection = await withApiProtection(request);
      if (protection.error) return protection.error;

      const idResult = await validateIdParam(params);
      if (idResult.error) return idResult.error;

      return withErrorHandling(
        () => findById(config.model, idResult.id),
        `Error fetching ${config.model?.name || 'record'}`
      )(protection);
    },

    // PUT /api/resource/[id]
    async updateById(request: NextRequest, params: Promise<{ id: string }>) {
      const idResult = await validateIdParam(params);
      if (idResult.error) return idResult.error;

      // SECURITY: Use secure write operation with full validation
      const writeResult = await secureWriteOperation(request, {
        schema: config.updateSchema,
        operation: 'update',
        resourceType: config.resourceType,
        requiresRole: 'user', // Minimum role for updates
      });

      if (!writeResult.success) {
        return writeResult.error;
      }

      const { data, userId } = writeResult;

      // Run before-update hook if provided
      if (config.beforeUpdate) {
        const hookResult = await config.beforeUpdate(idResult.id, data);
        if (hookResult) return hookResult;
      }

      // SECURITY: Sanitize data and apply transforms
      const sanitizedData = sanitizeWriteData(data as Record<string, unknown>, ['id', 'createdAt', 'updatedAt']);
      const updateData = config.updateTransform 
        ? config.updateTransform(sanitizedData as TUpdate)
        : sanitizedData;

      try {
        // Get old data before update for logging
        const oldData = await config.model.findUnique({ where: { id: idResult.id } });
        
        const result = await config.model.update({ 
          where: { id: idResult.id }, 
          data: updateData 
        });
        console.log(`SECURE UPDATE: User ${userId} updated ${config.resourceType} ID ${idResult.id}`);
        
        // Log activity
        const logger = getActivityLogger(config.resourceType);
        if (logger && oldData) {
          await logger.logUpdate(idResult.id.toString(), oldData, result, request);
        }
        
        return NextResponse.json(result);
      } catch (error) {
        console.error(`Error updating ${config.resourceType}:`, error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },

    // DELETE /api/resource/[id]
    async deleteById(request: NextRequest, params: Promise<{ id: string }>) {
      // SECURITY: Validate authentication and admin/manager role for deletes
      const protection = await withApiProtection(request);
      if (protection.error) return protection.error;

      // SECURITY: Only managers and admins can delete
      const userRole = await getUserRole(protection.userId);
      if (userRole !== 'admin' && userRole !== 'manager') {
        console.warn(`SECURITY: User ${protection.userId} (${userRole}) attempted delete on ${config.resourceType}`);
        return NextResponse.json({ 
          error: 'Forbidden - Manager or Admin role required for delete operations' 
        }, { status: 403 });
      }

      const idResult = await validateIdParam(params);
      if (idResult.error) return idResult.error;

      // Run before-delete hook if provided
      if (config.beforeDelete) {
        const hookResult = await config.beforeDelete(idResult.id);
        if (hookResult) return hookResult;
      }

      try {
        // Get data before delete for logging
        const dataToDelete = await config.model.findUnique({ where: { id: idResult.id } });
        
        await deleteById(config.model, idResult.id);
        console.log(`SECURE DELETE: User ${protection.userId} (${userRole}) deleted ${config.resourceType} ID ${idResult.id}`);
        
        // Log activity
        const logger = getActivityLogger(config.resourceType);
        if (logger && dataToDelete) {
          await logger.logDelete(idResult.id.toString(), dataToDelete, request);
        }
        
        return NextResponse.json({ success: true });
      } catch (error) {
        console.error(`Error deleting ${config.resourceType}:`, error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    }
  };
}