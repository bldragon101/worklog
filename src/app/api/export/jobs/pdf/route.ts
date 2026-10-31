import { NextResponse } from "next/server";
import { createElement, type ReactElement } from "react";
import { renderToStream, type DocumentProps } from "@react-pdf/renderer";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api-route";
import { buildCompanyLogoAssets } from "@/lib/company-logo";
import {
  JobsPdfTemplate,
  type JobsPdfJob,
} from "@/components/entities/job/jobs-pdf-template";

const MAX_JOBS_PER_EXPORT = 5000;

const exportJobsPdfSchema = z.object({
  jobIds: z
    .array(z.number().int().positive())
    .min(1, "Select at least one job to export")
    .max(MAX_JOBS_PER_EXPORT),
  periodLabel: z.string().trim().max(120).optional(),
  appliedFilters: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(60),
        values: z.array(z.string().trim().max(200)).min(1).max(500),
      }),
    )
    .max(20)
    .optional(),
  search: z.string().trim().max(200).optional(),
  selectedOnly: z.boolean().optional(),
});

function formatGeneratedAt(): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/**
 * POST /api/export/jobs/pdf
 * Render the given jobs as an A4 landscape PDF, grouped by day.
 */
export const POST = apiRoute({
  rateLimit: "export",
  auth: "user",
  errorMessage: "Error exporting jobs to PDF",
  responseMessage: "Failed to export jobs to PDF",
  validationMessage: "Invalid export request",
  handler: async ({ request }) => {
    const body = exportJobsPdfSchema.parse(await request.json());
    const jobIds = [...new Set(body.jobIds)];

    const [jobs, settings] = await Promise.all([
      prisma.jobs.findMany({
        where: { id: { in: jobIds } },
        orderBy: [{ date: "asc" }, { driver: "asc" }, { startTime: "asc" }],
      }),
      prisma.companySettings.findFirst(),
    ]);

    const { logoDataUrl } = settings
      ? await buildCompanyLogoAssets({ companyLogo: settings.companyLogo })
      : { logoDataUrl: "" };

    const pdfJobs: JobsPdfJob[] = jobs.map((job) => ({
      id: job.id,
      date: job.date.toISOString(),
      driver: job.driver,
      customer: job.customer,
      billTo: job.billTo,
      registration: job.registration,
      truckType: job.truckType,
      pickup: job.pickup,
      dropoff: job.dropoff,
      startTime: job.startTime ? job.startTime.toISOString() : null,
      finishTime: job.finishTime ? job.finishTime.toISOString() : null,
      chargedHours: job.chargedHours,
      travelTimeHours: job.travelTimeHours,
      driverCharge: job.driverCharge,
      deductionHours: job.deductionHours,
      driverOnly: job.driverOnly ?? false,
      runsheet: job.runsheet ?? false,
      invoiced: job.invoiced ?? false,
      jobReference: job.jobReference,
      eastlink: job.eastlink,
      citylink: job.citylink,
      comments: job.comments,
    }));

    const pdfDocument = createElement(JobsPdfTemplate, {
      jobs: pdfJobs,
      periodLabel: body.periodLabel || null,
      appliedFilters: body.appliedFilters ?? [],
      search: body.search || null,
      selectedOnly: body.selectedOnly ?? false,
      generatedAt: formatGeneratedAt(),
      settings: {
        companyName: settings?.companyName || "",
        companyAbn: settings?.companyAbn || "",
        companyAddress: settings?.companyAddress || "",
        companyPhone: settings?.companyPhone || "",
        companyEmail: settings?.companyEmail || "",
        companyLogo: logoDataUrl,
      },
    }) as ReactElement<DocumentProps>;

    const stream = await renderToStream(pdfDocument);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    return new NextResponse(Buffer.concat(chunks), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="jobs.pdf"',
      },
    });
  },
});
