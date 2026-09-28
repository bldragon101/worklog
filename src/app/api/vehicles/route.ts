import { NextResponse } from "next/server";
import { createCrudHandlers } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { vehicleSchema } from "@/lib/validation";
import { z } from "zod";

type VehicleCreateData = z.infer<typeof vehicleSchema>;

// Create CRUD handlers for vehicles
const vehicleHandlers = createCrudHandlers({
  model: prisma.vehicle,
  createSchema: vehicleSchema,
  updateSchema: vehicleSchema.partial(),
  resourceType: "vehicle", // SECURITY: Required for payload validation
  tableName: "Vehicle", // For activity logging
  listOrderBy: { expiryDate: "asc" },
  createTransform: (data: VehicleCreateData) => ({
    registration: data.registration,
    expiryDate: new Date(data.expiryDate),
    make: data.make,
    model: data.model,
    yearOfManufacture: data.yearOfManufacture,
    type: data.type,
    carryingCapacity: data.carryingCapacity || null,
    trayLength: data.trayLength || null,
    craneReach: data.craneReach || null,
    craneType: data.craneType || null,
    craneCapacity: data.craneCapacity || null,
  }),
  beforeCreate: async ({ data }: { data: VehicleCreateData }) => {
    // Check if registration already exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { registration: data.registration },
    });

    if (existingVehicle) {
      return NextResponse.json(
        { error: "Vehicle with this registration already exists" },
        { status: 409 },
      );
    }
    return null;
  },
});

export const GET = vehicleHandlers.list;
export const POST = vehicleHandlers.create;
