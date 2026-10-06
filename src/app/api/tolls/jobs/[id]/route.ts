import { NextResponse } from "next/server";
import { ApiError, apiRoute, idParams } from "@/lib/api-route";
import { loadJobTolls } from "@/lib/tolls/job-toll-trips";

/** The Linkt toll trips matched to a job, for the job details sidebar */
export const GET = apiRoute({
  auth: { permission: "manage_tolls" },
  params: idParams({ message: "Invalid job ID" }),
  errorMessage: "Error fetching job tolls",
  responseMessage: "Failed to fetch job tolls",
  handler: async ({ params: { id } }) => {
    const jobTolls = await loadJobTolls({ jobId: id });
    if (!jobTolls) throw new ApiError({ status: 404, message: "Job not found" });

    return NextResponse.json(jobTolls);
  },
});
