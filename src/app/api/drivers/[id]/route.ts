import { NextRequest, NextResponse } from "next/server";
import { createCrudHandlers } from "@/lib/api-helpers";
import { apiRoute, idParams, type RouteContext } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { driverSchema } from "@/lib/validation";
import { z } from "zod";
import {
  canManageDriverBankDetails,
  DRIVER_BANK_DETAIL_FIELDS,
  serialiseDriver,
} from "@/lib/driver-serialisation";
import { getCurrentUserRole, getUserRole } from "@/lib/permissions";

type DriverUpdateData = Partial<z.infer<typeof driverSchema>>;

// Create CRUD handlers for drivers
const driverHandlers = createCrudHandlers({
  model: prisma.driver,
  createSchema: driverSchema,
  updateSchema: driverSchema.partial(),
  resourceType: "driver", // SECURITY: Required for payload validation
  // SECURITY: Only roles that may manage bank details can write them
  restrictedFields: ({ userRole }) =>
    canManageDriverBankDetails({ userRole }) ? [] : DRIVER_BANK_DETAIL_FIELDS,
  listOrderBy: { createdAt: "desc" },
  updateTransform: (data: DriverUpdateData) => {
    const result: Partial<DriverUpdateData> = {};

    // Preserve undefined for all fields that aren't explicitly provided
    if (data.driver !== undefined) result.driver = data.driver.toUpperCase();
    if (data.lastName !== undefined)
      result.lastName = data.lastName ? data.lastName.toUpperCase() : null;
    if (data.truck !== undefined) result.truck = data.truck.toUpperCase();
    if (data.tray !== undefined) result.tray = data.tray;
    if (data.crane !== undefined) result.crane = data.crane;
    if (data.semi !== undefined) result.semi = data.semi;
    if (data.semiCrane !== undefined) result.semiCrane = data.semiCrane;
    if (data.breaks !== undefined) result.breaks = data.breaks;
    if (data.type !== undefined) result.type = data.type;

    // Handle subcontractor-specific fields based on type changes
    if (data.type !== undefined) {
      if (data.type !== "Subcontractor") {
        // If explicitly changing to non-Subcontractor, clear tolls/fuelLevy
        result.tolls = false;
        result.fuelLevy = null;
      } else {
        // If explicitly changing to Subcontractor, set only if provided
        if (data.tolls !== undefined) result.tolls = data.tolls;
        if (data.fuelLevy !== undefined) result.fuelLevy = data.fuelLevy;
      }
    } else {
      // If type not provided, still allow tolls/fuelLevy updates
      if (data.tolls !== undefined) result.tolls = data.tolls;
      if (data.fuelLevy !== undefined) result.fuelLevy = data.fuelLevy;
    }

    // Driver details for RCTI - preserve undefined
    if (data.businessName !== undefined)
      result.businessName = data.businessName;
    if (data.abn !== undefined) result.abn = data.abn;
    if (data.address !== undefined) result.address = data.address;
    if (data.email !== undefined) result.email = data.email;
    if (data.bankAccountName !== undefined)
      result.bankAccountName = data.bankAccountName;
    if (data.bankAccountNumber !== undefined)
      result.bankAccountNumber = data.bankAccountNumber;
    if (data.bankBsb !== undefined) result.bankBsb = data.bankBsb;
    if (data.gstMode !== undefined) result.gstMode = data.gstMode;
    if (data.gstStatus !== undefined) result.gstStatus = data.gstStatus;

    // Archive status
    if (data.isArchived !== undefined) result.isArchived = data.isArchived;

    return result;
  },
});

export const GET = apiRoute({
  auth: "user",
  params: idParams({ message: "Invalid ID" }),
  errorMessage: "Error fetching driver",
  handler: async ({ userId, params: { id } }) => {
    const [driver, userRole] = await Promise.all([
      prisma.driver.findUnique({ where: { id } }),
      getUserRole(userId),
    ]);
    if (!driver) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const includeBankDetails = canManageDriverBankDetails({ userRole });
    return NextResponse.json(serialiseDriver({ driver, includeBankDetails }));
  },
});

export async function PUT(request: NextRequest, context: RouteContext) {
  const result = await driverHandlers.updateById(request, context);
  if (!result.ok) return result;

  const [data, userRole] = await Promise.all([
    result.json(),
    getCurrentUserRole(),
  ]);
  const includeBankDetails = canManageDriverBankDetails({ userRole });
  return NextResponse.json(
    serialiseDriver({ driver: data, includeBankDetails }),
  );
}

export const DELETE = driverHandlers.deleteById;
