import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { getUserRole } from '@/lib/permissions';

// Maximum payload sizes for different operations
const MAX_PAYLOAD_SIZES = {
  job: 50 * 1024,      // 50KB max for job data
  customer: 20 * 1024,  // 20KB max for customer data  
  vehicle: 30 * 1024,   // 30KB max for vehicle data
  general: 10 * 1024,   // 10KB max for general operations
} as const;

/**
 * SECURITY: Server-side write validation wrapper
 * Validates payload size, types, and user permissions
 */
export async function secureWriteOperation<T>(
  request: NextRequest,
  options: {
    schema: z.ZodSchema<T>;
    operation: 'create' | 'update' | 'delete';
    resourceType: keyof typeof MAX_PAYLOAD_SIZES;
    requiresRole?: 'admin' | 'manager' | 'user';
    validateOwnership?: (userId: string, data: T) => Promise<boolean>;
  }
): Promise<{ 
  success: true; 
  data: T; 
  userId: string; 
  userRole: string;
} | { 
  success: false; 
  error: NextResponse;
}> {
  try {
    // SECURITY: Validate authentication first
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      };
    }

    // SECURITY: Validate user role permissions
    const userRole = getUserRole(userId);
    if (options.requiresRole) {
      const hasPermission = checkRolePermission(userRole, options.requiresRole, options.operation);
      if (!hasPermission) {
        logSecurityViolation(userId, `Insufficient role for ${options.operation} on ${options.resourceType}`);
        return {
          success: false,
          error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        };
      }
    }

    // SECURITY: Validate payload size
    const contentLength = request.headers.get('content-length');
    const maxSize = MAX_PAYLOAD_SIZES[options.resourceType];
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      logSecurityViolation(userId, `Payload too large: ${contentLength} > ${maxSize}`);
      return {
        success: false,
        error: NextResponse.json({ error: 'Payload too large' }, { status: 413 })
      };
    }

    // SECURITY: Parse and validate request body
    let rawBody: string;
    try {
      rawBody = await request.text();
      if (rawBody.length > maxSize) {
        logSecurityViolation(userId, `Request body too large: ${rawBody.length} > ${maxSize}`);
        return {
          success: false,
          error: NextResponse.json({ error: 'Request body too large' }, { status: 413 })
        };
      }
    } catch {
      return {
        success: false,
        error: NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
      };
    }

    // SECURITY: Parse JSON and validate schema
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(rawBody);
    } catch {
      return {
        success: false,
        error: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
      };
    }

    // SECURITY: Validate against schema
    const validationResult = options.schema.safeParse(parsedData);
    if (!validationResult.success) {
      logSecurityViolation(userId, `Schema validation failed: ${validationResult.error.message}`);
      return {
        success: false,
        error: NextResponse.json({ 
          error: 'Validation failed', 
          details: validationResult.error.flatten()
        }, { status: 400 })
      };
    }

    // SECURITY: Validate ownership if required
    if (options.validateOwnership) {
      const hasOwnership = await options.validateOwnership(userId, validationResult.data);
      if (!hasOwnership) {
        logSecurityViolation(userId, `Ownership validation failed for ${options.resourceType}`);
        return {
          success: false,
          error: NextResponse.json({ error: 'Access denied - ownership required' }, { status: 403 })
        };
      }
    }

    // SECURITY: Log successful validation
    logSecureOperation(userId, userRole, options.operation, options.resourceType);

    return {
      success: true,
      data: validationResult.data,
      userId,
      userRole
    };

  } catch (error) {
    console.error('Secure write operation error:', error);
    return {
      success: false,
      error: NextResponse.json({ error: 'Internal security error' }, { status: 500 })
    };
  }
}

/**
 * SECURITY: Check if user role has permission for operation
 */
function checkRolePermission(
  userRole: string, 
  requiredRole: 'admin' | 'manager' | 'user',
  operation: 'create' | 'update' | 'delete'
): boolean {
  const roleHierarchy = { admin: 3, manager: 2, user: 1, viewer: 0 };
  const requiredLevel = roleHierarchy[requiredRole] || 0;
  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;

  // Delete operations require higher privileges
  if (operation === 'delete' && userLevel < 2) {
    return false;
  }

  return userLevel >= requiredLevel;
}

/**
 * SECURITY: Log security violations
 */
function logSecurityViolation(userId: string, violation: string) {
  const timestamp = new Date().toISOString();
  console.warn(`SECURITY VIOLATION [${timestamp}]: User ${userId} - ${violation}`);
  
  // In production, send to security monitoring
  // await securityLog.create({ userId, violation, timestamp, level: 'WARNING' });
}

/**
 * SECURITY: Log successful secure operations
 */
function logSecureOperation(userId: string, userRole: string, operation: string, resourceType: string) {
  console.log(`SECURE OPERATION: User ${userId} (${userRole}) performed ${operation} on ${resourceType}`);
  
  // In production, log to audit trail
  // await auditLog.create({ userId, userRole, operation, resourceType, timestamp: new Date() });
}

/**
 * SECURITY: Sanitize data before database operations
 * Remove any fields that should never be set by clients
 */
export function sanitizeWriteData<T extends Record<string, unknown>>(
  data: T,
  forbiddenFields: string[] = ['id', 'createdAt', 'updatedAt', 'userId']
): Omit<T, keyof typeof forbiddenFields[number]> {
  const sanitized = { ...data };
  
  forbiddenFields.forEach(field => {
    if (field in sanitized) {
      delete sanitized[field];
      console.warn(`SECURITY: Removed forbidden field '${field}' from write data`);
    }
  });
  
  return sanitized;
}