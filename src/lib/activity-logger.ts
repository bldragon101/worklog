import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

export interface ActivityLogData {
  action: "CREATE" | "UPDATE" | "DELETE";
  tableName: string;
  recordId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  description?: string;
  request?: NextRequest;
}

/**
 * Get client IP address from request
 */
function getClientIP(request?: NextRequest): string | null {
  if (!request) return null;

  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  if (realIP) {
    return realIP;
  }

  return null;
}

/**
 * Get user agent from request
 */
function getUserAgent(request?: NextRequest): string | null {
  if (!request) return null;
  return request.headers.get("user-agent");
}

/**
 * Generate description for the activity
 */
function generateDescription(
  action: string,
  tableName: string,
  recordId: string,
  oldData?: Record<string, unknown>,
  newData?: Record<string, unknown>,
): string {
  const entityName = getEntityName(tableName, newData || oldData);

  switch (action) {
    case "CREATE":
      return `Created ${tableName.toLowerCase()}: ${entityName}`;
    case "DELETE":
      return `Deleted ${tableName.toLowerCase()}: ${entityName}`;
    case "UPDATE":
      if (oldData && newData) {
        const changes = getFieldChanges(oldData, newData);
        if (changes.length > 0) {
          return `Updated ${tableName.toLowerCase()} ${entityName}: ${changes.slice(0, 3).join(", ")}${changes.length > 3 ? ` and ${changes.length - 3} more` : ""}`;
        }
      }
      return `Updated ${tableName.toLowerCase()}: ${entityName}`;
    default:
      return `${action} ${tableName.toLowerCase()} ID ${recordId}`;
  }
}

/**
 * Get a human-readable entity name
 */
function getEntityName(
  tableName: string,
  data?: Record<string, unknown>,
): string {
  if (!data) return "Unknown";

  switch (tableName) {
    case "Jobs":
      return `${data.customer || "Unknown Customer"} (${data.date ? new Date(data.date as string).toLocaleDateString() : "No Date"})`;
    case "Customer":
      return `${data.customer || "Unknown Customer"}`;
    case "Driver":
      return `${data.driver || "Unknown Driver"}`;
    case "Vehicle":
      return `${data.registration || "Unknown Registration"}`;
    default:
      return `ID ${data.id || "Unknown"}`;
  }
}

/**
 * Get field changes between old and new data
 */
function getFieldChanges(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
): string[] {
  const changes: string[] = [];

  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  for (const key of allKeys) {
    if (["id", "createdAt", "updatedAt"].includes(key)) continue;

    const oldValue = oldData[key];
    const newValue = newData[key];

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      const fieldName = getFieldDisplayName(key);
      if (oldValue === null || oldValue === undefined) {
        changes.push(`set ${fieldName}`);
      } else if (newValue === null || newValue === undefined) {
        changes.push(`cleared ${fieldName}`);
      } else {
        changes.push(`changed ${fieldName}`);
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
    billTo: "Bill To",
    truckType: "Truck Type",
    chargedHours: "Charged Hours",
    driverCharge: "Driver Charge",
    fuelLevy: "Fuel Levy",
    startTime: "Start Time",
    finishTime: "Finish Time",
  };

  return (
    fieldMap[fieldName] ||
    fieldName.charAt(0).toUpperCase() + fieldName.slice(1)
  );
}

/**
 * Log user activity to the database
 */
export async function logActivity(data: ActivityLogData): Promise<void> {
  try {
    const { userId } = await auth();

    if (!userId) {
      console.warn("Activity logging skipped: No authenticated user");
      return;
    }

    // Get user email from Clerk
    let userEmail: string | null = null;
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      userEmail =
        user.emailAddresses.find(
          (email) => email.id === user.primaryEmailAddressId,
        )?.emailAddress ||
        user.emailAddresses[0]?.emailAddress ||
        null;
    } catch (error) {
      console.error("Failed to fetch user email from Clerk:", error);
    }

    // Generate description if not provided
    const description =
      data.description ||
      generateDescription(
        data.action,
        data.tableName,
        data.recordId,
        data.oldData,
        data.newData,
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
        description,
        ipAddress: getClientIP(data.request),
        userAgent: getUserAgent(data.request),
      },
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
    // Don't throw error to avoid breaking the main operation
  }
}
