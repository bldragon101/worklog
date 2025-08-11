import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';
import { checkPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * SECURITY: Sanitize sensitive data from logs
 * Remove or mask fields that might contain sensitive information
 */
function sanitizeLogData(data: unknown): unknown {
  if (!data || typeof data !== 'object' || data === null) return data;
  
  const sanitized = { ...(data as Record<string, unknown>) };
  
  // Define fields that should be masked or removed
  const sensitiveFields = [
    'password', 'token', 'apiKey', 'secret', 'ssn', 'creditCard',
    'bankAccount', 'taxId', 'driverLicense'
  ];
  
  // Define fields that should be partially masked
  const partiallyMaskedFields = ['email', 'phone', 'contact'];
  
  for (const [key, value] of Object.entries(sanitized)) {
    const lowerKey = key.toLowerCase();
    
    // Remove highly sensitive fields completely
    if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    }
    // Partially mask email and phone fields
    else if (partiallyMaskedFields.some(field => lowerKey.includes(field.toLowerCase()))) {
      if (typeof value === 'string' && value.includes('@')) {
        // Email: show first 2 chars and domain
        const [user, domain] = value.split('@');
        sanitized[key] = user.length > 2 ? `${user.substring(0, 2)}***@${domain}` : `***@${domain}`;
      } else if (typeof value === 'string' && value.length > 4) {
        // Other contact info: show first 2 and last 2 chars
        sanitized[key] = `${value.substring(0, 2)}***${value.substring(value.length - 2)}`;
      }
    }
  }
  
  return sanitized;
}

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Apply rate limiting
    const rateLimitResult = rateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // SECURITY: Check authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // SECURITY: Check admin permission
    const hasHistoryAccess = await checkPermission('view_history');
    if (!hasHistoryAccess) {
      console.warn(`SECURITY: User ${authResult.userId} attempted to access activity logs without permission`);
      return NextResponse.json({
        error: 'Forbidden - Admin access required for viewing activity history'
      }, { status: 403 });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100); // Max 100 per page
    const skip = (page - 1) * limit;

    // SECURITY: Validate and sanitize filter parameters
    const userId = url.searchParams.get('userId');
    const tableName = url.searchParams.get('tableName');
    const action = url.searchParams.get('action');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    
    // Validate tableName against allowed values
    const allowedTableNames = ['Jobs', 'Customer', 'Driver', 'Vehicle'];
    if (tableName && !allowedTableNames.includes(tableName)) {
      return NextResponse.json({
        error: 'Invalid table name parameter'
      }, { status: 400 });
    }
    
    // Validate action against allowed values  
    const allowedActions = ['CREATE', 'UPDATE', 'DELETE'];
    if (action && !allowedActions.includes(action)) {
      return NextResponse.json({
        error: 'Invalid action parameter'
      }, { status: 400 });
    }
    
    // Validate date parameters
    if (startDate && isNaN(Date.parse(startDate))) {
      return NextResponse.json({
        error: 'Invalid start date format'
      }, { status: 400 });
    }
    
    if (endDate && isNaN(Date.parse(endDate))) {
      return NextResponse.json({
        error: 'Invalid end date format'
      }, { status: 400 });
    }

    // Build where clause
    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (tableName) where.tableName = tableName;
    if (action) where.action = action;
    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.createdAt = dateFilter;
    }

    // Get total count for pagination
    const total = await prisma.activityLog.count({ where });

    // Get paginated results
    const logs = await prisma.activityLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        userEmail: true,
        action: true,
        tableName: true,
        recordId: true,
        description: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        // Include full data by default for better history tracking
        oldData: true,
        newData: true
      }
    });

    // SECURITY: Sanitize sensitive data from logs before returning
    const sanitizedLogs = logs.map(log => ({
      ...log,
      oldData: log.oldData ? sanitizeLogData(log.oldData) : null,
      newData: log.newData ? sanitizeLogData(log.newData) : null
    }));

    return NextResponse.json({
      logs: sanitizedLogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }, {
      headers: {
        ...rateLimitResult.headers,
        // SECURITY: Additional security headers
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}