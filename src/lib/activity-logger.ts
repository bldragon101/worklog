import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';

export interface ActivityLogData {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  tableName: string;
  recordId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  description: string;
  request?: NextRequest;
}

/**
 * Get client IP address from request
 */
function getClientIP(request?: NextRequest): string | null {
  if (!request) return null;
  
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const remoteAddr = request.headers.get('remote-addr');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  if (remoteAddr) {
    return remoteAddr;
  }
  
  return null;
}

/**
 * Get user agent from request
 */
function getUserAgent(request?: NextRequest): string | null {
  if (!request) return null;
  return request.headers.get('user-agent');
}

/**
 * Generate detailed description with field changes for updates
 */
function generateDetailedDescription(action: string, tableName: string, recordId: string, oldData?: Record<string, unknown>, newData?: Record<string, unknown>): string {
  if (action === 'CREATE') {
    const identifier = getRecordIdentifier(tableName, newData);
    return `Created ${tableName.toLowerCase()}: ${identifier}`;
  }
  
  if (action === 'DELETE') {
    const identifier = getRecordIdentifier(tableName, oldData);
    return `Deleted ${tableName.toLowerCase()}: ${identifier}`;
  }
  
  if (action === 'UPDATE' && oldData && newData) {
    const identifier = getRecordIdentifier(tableName, newData) || getRecordIdentifier(tableName, oldData);
    const changes = getFieldChanges(oldData, newData);
    
    if (changes.length > 0) {
      return `Updated ${tableName.toLowerCase()} ${identifier}: ${changes.join(', ')}`;
    } else {
      return `Updated ${tableName.toLowerCase()}: ${identifier}`;
    }
  }
  
  return `${action} ${tableName.toLowerCase()} ID ${recordId}`;
}

/**
 * Get a human-readable identifier for a record
 */
function getRecordIdentifier(tableName: string, data?: Record<string, unknown>): string {
  if (!data) return 'Unknown';
  
  switch (tableName) {
    case 'Jobs':
      return `${data.customer || 'Unknown Customer'} (${data.date ? new Date(data.date as string).toLocaleDateString() : 'No Date'})`;
    case 'Customer':
      return `${data.customer || 'Unknown Customer'}`;
    case 'Driver':
      return `${data.driver || 'Unknown Driver'}`;
    case 'Vehicle':
      return `${data.registration || 'Unknown Registration'}`;
    default:
      return `ID ${data.id || 'Unknown'}`;
  }
}

/**
 * Get field changes between old and new data
 */
function getFieldChanges(oldData: Record<string, unknown>, newData: Record<string, unknown>): string[] {
  const changes: string[] = [];
  
  // Get all keys from both objects
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  
  for (const key of allKeys) {
    // Skip system fields and IDs
    if (['id', 'createdAt', 'updatedAt'].includes(key)) continue;
    
    const oldValue = oldData[key];
    const newValue = newData[key];
    
    // Check if values are different
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      const fieldName = getFieldDisplayName(key);
      const oldDisplay = formatFieldValue(oldValue);
      const newDisplay = formatFieldValue(newValue);
      
      if (oldValue === null || oldValue === undefined) {
        changes.push(`set ${fieldName} to "${newDisplay}"`);
      } else if (newValue === null || newValue === undefined) {
        changes.push(`cleared ${fieldName}`);
      } else {
        changes.push(`changed ${fieldName} from "${oldDisplay}" to "${newDisplay}"`);
      }
    }
  }
  
  return changes;
}

/**
 * Convert field names to display names
 */
function getFieldDisplayName(fieldName: string): string {
  const fieldMap: Record<string, string> = {
    'billTo': 'Bill To',
    'truckType': 'Truck Type',
    'chargedHours': 'Charged Hours',
    'driverCharge': 'Driver Charge',
    'fuelLevy': 'Fuel Levy',
    'breakDeduction': 'Break Deduction',
    'semiCrane': 'Semi Crane',
    'yearOfManufacture': 'Year of Manufacture',
    'carryingCapacity': 'Carrying Capacity',
    'trayLength': 'Tray Length',
    'craneReach': 'Crane Reach',
    'craneType': 'Crane Type',
    'craneCapacity': 'Crane Capacity',
    'expiryDate': 'Expiry Date',
    'attachmentAction': 'Attachment Action',
    'attachmentFiles': 'Attachment Files',
    'attachmentTypes': 'Attachment Types',
    'attachmentFile': 'Attachment File',
    'attachmentType': 'Attachment Type'
  };
  
  return fieldMap[fieldName] || fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
}

/**
 * Format field values for display
 */
function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return 'empty';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string') {
    // Check if it's a date string
    const date = new Date(value);
    if (!isNaN(date.getTime()) && value.includes('T')) {
      return date.toLocaleDateString();
    }
    return value;
  }
  return String(value);
}

/**
 * Log user activity to the database
 */
export async function logActivity(data: ActivityLogData): Promise<void> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      console.warn('Activity logging skipped: No authenticated user');
      return;
    }

    // Fetch user details from Clerk
    let userEmail: string | null = null;
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      userEmail = user.emailAddresses.find(email => email.id === user.primaryEmailAddressId)?.emailAddress || 
                 user.emailAddresses[0]?.emailAddress || null;
    } catch (error) {
      console.error('Failed to fetch user email from Clerk:', error);
      // Continue without email - don't fail the logging
    }
    
    // Generate detailed description
    const detailedDescription = generateDetailedDescription(
      data.action,
      data.tableName,
      data.recordId,
      data.oldData,
      data.newData
    );

    await prisma.activityLog.create({
      data: {
        userId,
        userEmail,
        action: data.action,
        tableName: data.tableName,
        recordId: data.recordId,
        oldData: data.oldData ? JSON.parse(JSON.stringify(data.oldData)) : null,
        newData: data.newData ? JSON.parse(JSON.stringify(data.newData)) : null,
        description: detailedDescription,
        ipAddress: getClientIP(data.request),
        userAgent: getUserAgent(data.request),
      }
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw error to avoid breaking the main operation
  }
}

/**
 * Create activity logger for Jobs table
 */
export const JobsActivityLogger = {
  async logCreate(jobData: Record<string, unknown>, request?: NextRequest) {
    await logActivity({
      action: 'CREATE',
      tableName: 'Jobs',
      recordId: jobData.id?.toString() || 'unknown',
      newData: jobData,
      description: '', // Will be generated automatically
      request
    });
  },

  async logUpdate(jobId: string, oldData: Record<string, unknown>, newData: Record<string, unknown>, request?: NextRequest) {
    await logActivity({
      action: 'UPDATE',
      tableName: 'Jobs',
      recordId: jobId,
      oldData,
      newData,
      description: '', // Will be generated automatically
      request
    });
  },

  async logDelete(jobId: string, jobData: Record<string, unknown>, request?: NextRequest) {
    await logActivity({
      action: 'DELETE',
      tableName: 'Jobs',
      recordId: jobId,
      oldData: jobData,
      description: '', // Will be generated automatically
      request
    });
  },

  async logAttachmentUpload(jobId: string, jobData: Record<string, unknown>, attachmentData: {
    fileCount: number;
    attachmentTypes: string[];
    fileNames: string[];
  }, request?: NextRequest) {
    const description = `Uploaded ${attachmentData.fileCount} attachment${attachmentData.fileCount > 1 ? 's' : ''} to job: ${attachmentData.fileNames.join(', ')} (${attachmentData.attachmentTypes.join(', ')})`;
    
    await logActivity({
      action: 'UPDATE',
      tableName: 'Jobs',
      recordId: jobId,
      oldData: jobData,
      newData: { 
        ...jobData, 
        attachmentAction: 'UPLOAD',
        attachmentFiles: attachmentData.fileNames,
        attachmentTypes: attachmentData.attachmentTypes
      },
      description,
      request
    });
  },

  async logAttachmentDelete(jobId: string, jobData: Record<string, unknown>, attachmentData: {
    attachmentType: string;
    fileName: string;
  }, request?: NextRequest) {
    const description = `Deleted attachment from job: ${attachmentData.fileName} (${attachmentData.attachmentType})`;
    
    await logActivity({
      action: 'UPDATE',
      tableName: 'Jobs',
      recordId: jobId,
      oldData: jobData,
      newData: { 
        ...jobData, 
        attachmentAction: 'DELETE',
        attachmentFile: attachmentData.fileName,
        attachmentType: attachmentData.attachmentType
      },
      description,
      request
    });
  }
};

/**
 * Create activity logger for Customer table
 */
export const CustomerActivityLogger = {
  async logCreate(customerData: Record<string, unknown>, request?: NextRequest) {
    await logActivity({
      action: 'CREATE',
      tableName: 'Customer',
      recordId: customerData.id?.toString() || 'unknown',
      newData: customerData,
      description: '', // Will be generated automatically
      request
    });
  },

  async logUpdate(customerId: string, oldData: Record<string, unknown>, newData: Record<string, unknown>, request?: NextRequest) {
    await logActivity({
      action: 'UPDATE',
      tableName: 'Customer',
      recordId: customerId,
      oldData,
      newData,
      description: '', // Will be generated automatically
      request
    });
  },

  async logDelete(customerId: string, customerData: Record<string, unknown>, request?: NextRequest) {
    await logActivity({
      action: 'DELETE',
      tableName: 'Customer',
      recordId: customerId,
      oldData: customerData,
      description: '', // Will be generated automatically
      request
    });
  }
};

/**
 * Create activity logger for Driver table
 */
export const DriverActivityLogger = {
  async logCreate(driverData: Record<string, unknown>, request?: NextRequest) {
    await logActivity({
      action: 'CREATE',
      tableName: 'Driver',
      recordId: driverData.id?.toString() || 'unknown',
      newData: driverData,
      description: '', // Will be generated automatically
      request
    });
  },

  async logUpdate(driverId: string, oldData: Record<string, unknown>, newData: Record<string, unknown>, request?: NextRequest) {
    await logActivity({
      action: 'UPDATE',
      tableName: 'Driver',
      recordId: driverId,
      oldData,
      newData,
      description: '', // Will be generated automatically
      request
    });
  },

  async logDelete(driverId: string, driverData: Record<string, unknown>, request?: NextRequest) {
    await logActivity({
      action: 'DELETE',
      tableName: 'Driver',
      recordId: driverId,
      oldData: driverData,
      description: '', // Will be generated automatically
      request
    });
  }
};

/**
 * Create activity logger for Vehicle table
 */
export const VehicleActivityLogger = {
  async logCreate(vehicleData: Record<string, unknown>, request?: NextRequest) {
    await logActivity({
      action: 'CREATE',
      tableName: 'Vehicle',
      recordId: vehicleData.id?.toString() || 'unknown',
      newData: vehicleData,
      description: '', // Will be generated automatically
      request
    });
  },

  async logUpdate(vehicleId: string, oldData: Record<string, unknown>, newData: Record<string, unknown>, request?: NextRequest) {
    await logActivity({
      action: 'UPDATE',
      tableName: 'Vehicle',
      recordId: vehicleId,
      oldData,
      newData,
      description: '', // Will be generated automatically
      request
    });
  },

  async logDelete(vehicleId: string, vehicleData: Record<string, unknown>, request?: NextRequest) {
    await logActivity({
      action: 'DELETE',
      tableName: 'Vehicle',
      recordId: vehicleId,
      oldData: vehicleData,
      description: '', // Will be generated automatically
      request
    });
  }
};