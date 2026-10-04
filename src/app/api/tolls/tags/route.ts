import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api-route";
import { normaliseRegistration } from "@/lib/tolls/toll-matching";

const assignTagSchema = z.object({
  tagNumber: z.string().trim().regex(/^\d{6,20}$/, {
    error: "Tag number must be digits only",
  }),
  registration: z
    .string()
    .trim()
    .min(1, { error: "Registration is required" })
    .max(20)
    .transform((registration) => normaliseRegistration({ registration }))
    .refine((registration) => registration.length > 0, {
      error: "Registration is required",
    }),
});

export const PUT = apiRoute({
  auth: { permission: "manage_tolls" },
  errorMessage: "Error assigning toll tag",
  responseMessage: "Failed to assign toll tag",
  validationMessage: "Invalid toll tag",
  handler: async ({ request }) => {
    const { tagNumber, registration } = assignTagSchema.parse(
      await request.json(),
    );

    const [, { count }] = await prisma.$transaction([
      prisma.tollTag.upsert({
        where: { tagNumber },
        create: { tagNumber, registration, source: "manual" },
        update: { registration, source: "manual" },
      }),
      prisma.tollTrip.updateMany({
        where: { tagNumber, lpn: null, registration: null },
        data: { registration },
      }),
    ]);

    return NextResponse.json({ tagNumber, registration, updatedTrips: count });
  },
});
