"use client";

import React from "react";
import { Copy } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Job } from "@/lib/types";

interface JobCopyDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
  onCopy: () => void;
}

export function JobCopyDetailsDialog({
  open,
  onOpenChange,
  job,
  onCopy,
}: JobCopyDetailsDialogProps) {
  const formattedDetails = formatJobDetails(job);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Copy Job Details</DialogTitle>
          <DialogDescription>
            The following job details will be copied to your clipboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-md">
            <pre className="text-sm whitespace-pre-wrap font-mono">
              {formattedDetails}
            </pre>
          </div>

          <div className="flex justify-end">
            <Button onClick={onCopy} className="gap-2">
              <Copy className="h-4 w-4" />
              Copy to Clipboard
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function formatJobDetails(job: Job): string {
  const date = format(new Date(job.date), "dd/MM/yyyy");
  const startTime = job.startTime
    ? format(new Date(job.startTime), "HH:mm")
    : "";
  const finishTime = job.finishTime
    ? format(new Date(job.finishTime), "HH:mm")
    : "";
  const timeRange = startTime && finishTime ? `${startTime}-${finishTime}` : "";

  let totalHours = "";
  if (job.startTime && job.finishTime) {
    const start = new Date(job.startTime);
    const finish = new Date(job.finishTime);
    const durationMs = finish.getTime() - start.getTime();
    if (durationMs >= 0) {
      const totalHoursDecimal = durationMs / (1000 * 60 * 60);
      totalHours = ` (${totalHoursDecimal.toFixed(2)}h)`;
    }
  }

  // Format tolls abbreviation
  let tollsLine = "";
  const citylink = job.citylink || 0;
  const eastlink = job.eastlink || 0;

  if (citylink > 0 || eastlink > 0) {
    const tollsParts: string[] = [];
    if (citylink > 0) {
      tollsParts.push(`${citylink}CL`);
    }
    if (eastlink > 0) {
      tollsParts.push(`${eastlink}EL`);
    }
    tollsLine = `Tolls: ${tollsParts.join(" ")}`;
  }

  // Build the formatted string
  const parts: string[] = [
    `${date}${timeRange ? ` - ${timeRange}` : ""}${totalHours}`,
    `Driver: ${job.driver}`,
  ];

  if (tollsLine) {
    parts.push(tollsLine);
  }

  if (job.pickup || job.dropoff) {
    const locationLine = [job.pickup, job.dropoff].filter(Boolean).join(" to ");
    if (locationLine) {
      parts.push(locationLine);
    }
  }

  if (job.jobReference) {
    parts.push(`Job Ref: ${job.jobReference}`);
  }

  if (job.comments) {
    parts.push(job.comments);
  }

  return parts.join("\n");
}
