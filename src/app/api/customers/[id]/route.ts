import { createCrudHandlers } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { customerSchema } from "@/lib/validation";
import { z } from "zod";

type CustomerUpdateData = Partial<z.infer<typeof customerSchema>>;

// Create CRUD handlers for customers
const customerHandlers = createCrudHandlers({
  model: prisma.customer,
  createSchema: customerSchema,
  updateSchema: customerSchema.partial(),
  resourceType: "customer", // SECURITY: Required for payload validation
  updateTransform: (data: CustomerUpdateData) => ({
    customer: data.customer,
    billTo: data.billTo,
    contact: data.contact,
    tray: data.tray || null,
    crane: data.crane || null,
    semi: data.semi || null,
    semiCrane: data.semiCrane || null,
    fuelLevy: data.fuelLevy ?? null,
    tolls: data.tolls || false,
    breakDeduction: data.breakDeduction || null,
    comments: data.comments || null,
  }),
});

export const PUT = customerHandlers.updateById;
export const DELETE = customerHandlers.deleteById;
export const GET = customerHandlers.getById;
