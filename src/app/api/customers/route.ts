import { createCrudHandlers } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { customerCreateSchema, customerSchema } from "@/lib/validation";
import { z } from "zod";

type CustomerCreateData = z.infer<typeof customerCreateSchema>;

// Create CRUD handlers for customers
const customerHandlers = createCrudHandlers({
  model: prisma.customer,
  createSchema: customerCreateSchema,
  updateSchema: customerSchema.partial(),
  resourceType: "customer", // SECURITY: Required for payload validation
  tableName: "Customer", // For activity logging
  listOrderBy: { createdAt: "desc" },
  createTransform: (data: CustomerCreateData) => ({
    customer: data.customer,
    billTo: data.billTo,
    contact: data.contact || "",
    tray: data.tray,
    crane: data.crane,
    semi: data.semi,
    semiCrane: data.semiCrane,
    fuelLevy: data.fuelLevy,
    tolls: data.tolls,
    breakDeduction: data.breakDeduction || null,
    comments: data.comments || null,
  }),
});

export const GET = customerHandlers.list;
export const POST = customerHandlers.create;
