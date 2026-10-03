import { NextResponse } from "next/server";
import { ApiError, apiRoute } from "@/lib/api-route";

const WORKFLOW_FILE = "linkt-tolls-sync.yml";

/**
 * Starts the GitHub Actions workflow that downloads recent trips from Linkt.
 * Needs GITHUB_DISPATCH_TOKEN (a token allowed to run the repo's actions) and
 * GITHUB_DISPATCH_REPO ("owner/repo"); GITHUB_DISPATCH_REF picks the branch.
 */
export const POST = apiRoute({
  rateLimit: "upload",
  auth: { permission: "manage_tolls" },
  errorMessage: "Error starting Linkt sync",
  responseMessage: "Failed to start Linkt sync",
  logErrorMessageOnly: true,
  handler: async () => {
    const token = process.env.GITHUB_DISPATCH_TOKEN;
    const repo = process.env.GITHUB_DISPATCH_REPO;
    if (!token || !repo) {
      throw new ApiError({
        status: 503,
        message: "Refreshing from Linkt is not set up. Upload a CSV export instead.",
      });
    }

    const response = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          ref: process.env.GITHUB_DISPATCH_REF ?? "main",
          inputs: { days: "14" },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub workflow dispatch failed with status ${response.status}`);
    }

    return NextResponse.json({ started: true });
  },
});
