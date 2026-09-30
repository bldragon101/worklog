import { NextResponse } from "next/server";
import { createCrudHandlers } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { vehicleSchema } from "@/lib/validation";
import { z } from "zod";

type VehicleUpdateData = Partial<z.infer<typeof vehicleSchema>>;

// Create CRUD handlers for vehicles
const vehicleHandlers = createCrudHandlers({
  model: prisma.vehicle,
  createSchema: vehicleSchema,
  updateSchema: vehicleSchema.partial(),
  resourceType: "vehicle", // SECURITY: Required for payload validation
  updateTransform: (data: VehicleUpdateData) => {
    const updateData: Record<string, unknown> = {};
    if (data.registration !== undefined)
      updateData.registration = data.registration;
    if (data.expiryDate !== undefined)
      updateData.expiryDate = new Date(data.expiryDate);
    if (data.make !== undefined) updateData.make = data.make;
    if (data.model !== undefined) updateData.model = data.model;
    if (data.yearOfManufacture !== undefined)
      updateData.yearOfManufacture = data.yearOfManufacture;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.carryingCapacity !== undefined)
      updateData.carryingCapacity = data.carryingCapacity;
    if (data.trayLength !== undefined) updateData.trayLength = data.trayLength;
    if (data.craneReach !== undefined) updateData.craneReach = data.craneReach;
    if (data.craneType !== undefined) updateData.craneType = data.craneType;
    if (data.craneCapacity !== undefined)
      updateData.craneCapacity = data.craneCapacity;
    return updateData;
  },
  beforeUpdate: async ({
    id,
    data,
  }: {
    id: number;
    data: VehicleUpdateData;
  }) => {
    // Check if vehicle exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!existingVehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    // If registration is being updated, check if it already exists for another vehicle
    if (
      data.registration &&
      data.registration !== existingVehicle.registration
    ) {
      const vehicleWithSameRegistration = await prisma.vehicle.findUnique({
        where: { registration: data.registration },
      });

      if (vehicleWithSameRegistration) {
        return NextResponse.json(
          { error: "Vehicle with this registration already exists" },
          { status: 409 },
        );
      }
    }
    return null;
  },
  beforeDelete: async ({ id }: { id: number }) => {
    // Check if vehicle exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!existingVehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }
    return null;
  },
});

export const GET = vehicleHandlers.getById;
export const PUT = vehicleHandlers.updateById;
export const DELETE = vehicleHandlers.deleteById;
