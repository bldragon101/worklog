import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute({
  auth: "user",
  errorMessage: "Error fetching customer select options",
  handler: async () => {
    // Fetch only the fields needed for selects
    const customers = await prisma.customer.findMany({
      select: {
        customer: true,
        billTo: true,
      },
      orderBy: {
        customer: "asc",
      },
    });

    // Create unique arrays for each field
    const customerOptions = [
      ...new Set(customers.map((c) => c.customer)),
    ].sort();
    const billToOptions = [...new Set(customers.map((c) => c.billTo))].sort();

    return NextResponse.json({
      customerOptions,
      billToOptions,
    });
  },
});
