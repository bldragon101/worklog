import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute({
  auth: "user",
  errorMessage: "Error fetching customer mappings",
  handler: async () => {
    // Fetch customers with their bill-to mappings
    const customers = await prisma.customer.findMany({
      select: {
        customer: true,
        billTo: true,
      },
      orderBy: {
        customer: "asc",
      },
    });

    // Create a mapping object where customer name maps to bill-to value
    const customerToBillTo: Record<string, string> = {};
    customers.forEach((c) => {
      customerToBillTo[c.customer] = c.billTo;
    });

    return NextResponse.json({
      customerToBillTo,
    });
  },
});
