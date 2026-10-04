"use client";

import type { Dispatch, SetStateAction } from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/skeleton";
import { getTotalDriverHours } from "@/lib/utils/rcti-calculations";
import type { Job } from "@/lib/types";

export interface RctiAddJobsDialogProps {
  availableJobs: Job[];
  selectedJobsToAdd: number[];
  setSelectedJobsToAdd: Dispatch<SetStateAction<number[]>>;
  onClose: () => void;
  onAddJobs: () => void;
  isSaving: boolean;
}

/**
 * Overlay for picking additional jobs from the RCTI's week to add as lines.
 */
export function RctiAddJobsDialog({
  availableJobs,
  selectedJobsToAdd,
  setSelectedJobsToAdd,
  onClose,
  onAddJobs,
  isSaving,
}: RctiAddJobsDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Add Jobs to RCTI</h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onClose()}
          >
            ×
          </Button>
        </div>

        {isSaving ? (
          <div className="py-8">
            <Spinner size="lg" className="mb-4" />
            <p className="text-sm text-muted-foreground text-center">
              Adding jobs...
            </p>
          </div>
        ) : availableJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No additional jobs available for this week
          </p>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {availableJobs.map((job) => (
                <label
                  key={job.id}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent"
                >
                  <input
                    id={`add-job-${job.id}-checkbox`}
                    type="checkbox"
                    checked={selectedJobsToAdd.includes(job.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedJobsToAdd([...selectedJobsToAdd, job.id]);
                      } else {
                        setSelectedJobsToAdd(
                          selectedJobsToAdd.filter((id) => id !== job.id),
                        );
                      }
                    }}
                    className="h-4 w-4"
                  />
                  <div className="flex-1">
                    <div className="font-medium">
                      {format(parseISO(job.date), "MMM d")} - {job.customer}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {job.driver} | {job.registration}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {job.truckType}
                      {job.startTime && job.finishTime
                        ? ` | ${job.startTime.substring(11, 16)} - ${job.finishTime.substring(11, 16)}`
                        : ""}
                      {" | "}
                      {getTotalDriverHours({
                        chargedHours: job.chargedHours,
                        travelTimeHours: job.travelTimeHours,
                        driverCharge: job.driverCharge,
                        deductionHours: job.deductionHours,
                      })}
                      hrs
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => onClose()}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => onAddJobs()}
                disabled={selectedJobsToAdd.length === 0 || isSaving}
              >
                Add {selectedJobsToAdd.length} Job(s)
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
