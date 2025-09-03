"use client";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  parseISO,
  compareAsc,
  getYear,
  getMonth,
} from "date-fns";
import type { VisibilityState } from "@tanstack/react-table";
import { JobsUnifiedDataTable } from "@/components/data-table/jobs/jobs-unified-data-table";
import { Job } from "@/lib/types";
import { JobForm } from "@/components/entities/job/job-form";
import { jobColumns } from "@/components/entities/job/job-columns";
import { createJobSheetFields } from "@/components/entities/job/job-sheet-fields";
import { JobDataTableToolbar } from "@/components/entities/job/job-data-table-toolbar";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { PageControls } from "@/components/layout/page-controls";
import { JobAttachmentUpload } from "@/components/ui/job-attachment-upload";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ProgressDialog } from "@/components/ui/progress-dialog";
import { useToast } from "@/hooks/use-toast";
import { FileCheck } from "lucide-react";

export default function DashboardPage() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Partial<Job> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Attachment upload state
  const [isAttachmentDialogOpen, setIsAttachmentDialogOpen] = useState(false);
  const [selectedJobForAttachment, setSelectedJobForAttachment] =
    useState<Job | null>(null);
  const [attachmentConfig, setAttachmentConfig] = useState<{
    baseFolderId: string;
    driveId: string;
  } | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobsToDelete, setJobsToDelete] = useState<Job[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Mark as invoiced loading state
  const [isMarkingInvoiced, setIsMarkingInvoiced] = useState(false);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/jobs");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Ensure data is an array
      setJobs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      setJobs([]); // Set empty array on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchAttachmentConfig();
  }, []);

  // Fetch Google Drive configuration for attachments from database
  const fetchAttachmentConfig = async () => {
    try {
      const response = await fetch(
        "/api/google-drive/settings?purpose=job_attachments",
      );
      const data = await response.json();

      if (response.ok && data.success && data.settings) {
        setAttachmentConfig({
          baseFolderId: data.settings.baseFolderId,
          driveId: data.settings.driveId,
        });
        console.log(
          "Loaded Google Drive attachment configuration from database for jobs page",
        );
      } else {
        console.log(
          "No Google Drive attachment configuration found in database",
        );
      }
    } catch (error) {
      console.error("Error fetching attachment config from database:", error);
    }
  };

  // --- REWORKED FILTER INITIALIZATION ---
  const getUpcomingSunday = () => {
    return endOfWeek(new Date(), { weekStartsOn: 1 }); // Monday is the start of the week
  };
  const upcomingSunday = getUpcomingSunday();

  // Add a special value for 'Show whole month'
  const SHOW_MONTH = "__SHOW_MONTH__";

  const [selectedYear, setSelectedYear] = useState<number>(
    getYear(upcomingSunday),
  );
  // NOTE: selectedMonth uses 0-based indexing (0 = January, 11 = December) from date-fns getMonth()
  const [selectedMonth, setSelectedMonth] = useState<number>(
    getMonth(upcomingSunday),
  );
  const [weekEnding, setWeekEnding] = useState<Date | string>(upcomingSunday);

  // Column visibility state management
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  // --- END REWORK ---

  // Get all unique years from jobs, ensuring the selected year is an option
  const yearsSet = new Set<number>(
    jobs.map((job) => getYear(parseISO(job.date))),
  );
  yearsSet.add(selectedYear);
  const years = Array.from(yearsSet).sort((a, b) => a - b);

  // Get months for selected year, ensuring selected month is an option
  // NOTE: getMonth() returns 0-based months (0 = January, 11 = December)
  const monthsSet = new Set<number>();
  jobs.forEach((job) => {
    const jobYear = getYear(parseISO(job.date));
    if (jobYear === selectedYear) {
      monthsSet.add(getMonth(parseISO(job.date))); // 0-based month
    }
  });
  monthsSet.add(selectedMonth);
  const months = Array.from(monthsSet).sort((a, b) => a - b);

  // Get week endings for selected year and month
  const weekEndingsSet = new Set<string>();
  jobs.forEach((job) => {
    const jobDate = parseISO(job.date);
    if (
      getYear(jobDate) === selectedYear &&
      getMonth(jobDate) === selectedMonth
    ) {
      weekEndingsSet.add(
        format(endOfWeek(jobDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      );
    }
  });

  // Also include week endings that start in the previous month but end in the selected month
  jobs.forEach((job) => {
    const jobDate = parseISO(job.date);
    const weekEnd = endOfWeek(jobDate, { weekStartsOn: 1 });
    // const weekStart = startOfWeek(jobDate, { weekStartsOn: 1 });

    // Include if the week ends in the selected month and year, even if it starts in previous month
    if (
      getYear(weekEnd) === selectedYear &&
      getMonth(weekEnd) === selectedMonth
    ) {
      weekEndingsSet.add(format(weekEnd, "yyyy-MM-dd"));
    }
  });

  // Add the current week ending if it's in the selected year and month
  if (
    getYear(weekEnding) === selectedYear &&
    getMonth(weekEnding) === selectedMonth
  ) {
    weekEndingsSet.add(format(weekEnding as Date, "yyyy-MM-dd"));
  }
  const weekEndings = Array.from(weekEndingsSet)
    .map((dateStr) => parseISO(dateStr))
    .sort((a, b) => compareAsc(a, b));

  // Filter logs for the selected year, month, and week (no days filtering)
  const filteredJobs = useMemo(() => {
    // If jobs haven't loaded yet, return empty array to show loading state
    if (jobs.length === 0) {
      return [];
    }

    const filtered = jobs.filter((job) => {
      if (!job.date) return false;
      const jobDate = parseISO(job.date);

      // If showing whole month, filter by year and month
      if (weekEnding === SHOW_MONTH) {
        const yearMatch = getYear(jobDate) === selectedYear;
        const monthMatch = getMonth(jobDate) === selectedMonth;

        if (!yearMatch || !monthMatch) {
          return false;
        }
      } else {
        // If showing specific week, prioritize week filtering over month filtering
        // This allows entries from previous month to show if they're within the selected week
        const weekStart = startOfWeek(weekEnding as Date, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(weekEnding as Date, { weekStartsOn: 1 });
        const isInSelectedWeek = isWithinInterval(jobDate, {
          start: weekStart,
          end: weekEnd,
        });

        if (!isInSelectedWeek) {
          return false;
        }

        // For week view, still filter by year but allow cross-month weeks
        if (getYear(jobDate) !== selectedYear) {
          return false;
        }
      }

      return true;
    });

    return filtered;
  }, [jobs, selectedYear, selectedMonth, weekEnding]);

  const startEdit = useCallback((job: Job) => {
    setEditingJob(job);
    setIsFormOpen(true);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingJob(null);
    setIsFormOpen(false);
  }, []);

  const deleteJob = useCallback((job: Job) => {
    setJobsToDelete([job]);
    setDeleteDialogOpen(true);
  }, []);

  const deleteMultipleJobs = useCallback((jobs: Job[]) => {
    setJobsToDelete(jobs);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      // Use bulk delete endpoint for better performance and atomicity
      const response = await fetch("/api/jobs/bulk", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobIds: jobsToDelete.map((job) => job.id),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Remove all deleted jobs from state
        const deletedIds = jobsToDelete.map((job) => job.id);
        setJobs((prev) => prev.filter((j) => !deletedIds.includes(j.id)));

        toast({
          title: "Jobs deleted successfully",
          description: `${data.deletedCount} job${data.deletedCount === 1 ? "" : "s"} deleted`,
          variant: "default",
        });

        setDeleteDialogOpen(false);
        setJobsToDelete([]);
      } else {
        // Some deletions failed
        toast({
          title: "Some deletions failed",
          description: "Please refresh and try again",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting jobs:", error);
      toast({
        title: "Error deleting jobs",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [jobsToDelete, toast]);

  const markJobsAsInvoiced = useCallback(
    async (jobs: Job[]) => {
      setIsMarkingInvoiced(true);
      try {
        // Use bulk update endpoint for better performance and atomicity
        const response = await fetch("/api/jobs/bulk", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jobIds: jobs.map((job) => job.id),
            updates: { invoiced: true },
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Update jobs state with the returned updated jobs
          setJobs((prev) =>
            prev.map((job) => {
              const updatedJob = data.updatedJobs.find(
                (u: Job) => u.id === job.id,
              );
              return updatedJob || job;
            }),
          );

          toast({
            title: "Jobs marked as invoiced",
            description: `${data.updatedCount} job${data.updatedCount === 1 ? "" : "s"} marked as invoiced successfully`,
            variant: "default",
          });
        } else {
          // Some updates failed
          toast({
            title: "Some updates failed",
            description: "Please refresh and try again",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error marking jobs as invoiced:", error);
        toast({
          title: "Error marking jobs as invoiced",
          description: "Please try again",
          variant: "destructive",
        });
      } finally {
        setIsMarkingInvoiced(false);
      }
    },
    [toast],
  );

  const saveEdit = useCallback(
    async (jobData: Partial<Job>) => {
      setIsSubmitting(true);
      try {
        const isNew = !jobData.id;
        const url = isNew ? "/api/jobs" : `/api/jobs/${jobData.id}`;
        const method = isNew ? "POST" : "PUT";

        console.log("Sending job data:", jobData);

        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(jobData),
        });

        if (response.ok) {
          const savedJob = await response.json();
          setJobs((prev) =>
            isNew
              ? [savedJob, ...prev]
              : prev.map((job) => (job.id === savedJob.id ? savedJob : job)),
          );
          cancelEdit();
        } else {
          const errorData = await response.json();
          console.error("API Error:", errorData);
          alert(`Error saving job: ${errorData.error}`);
        }
      } catch (error) {
        console.error("Error saving job:", error);
        alert("Error saving job. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [cancelEdit],
  );

  const addEntry = useCallback(() => {
    setEditingJob({});
    setIsFormOpen(true);
  }, []);

  // Handle attachment upload
  const handleAttachFiles = useCallback(
    (job: Job) => {
      if (!attachmentConfig) {
        toast({
          title: "Configuration Required",
          description:
            "Google Drive configuration is required for file attachments. Please check the integrations page.",
          variant: "destructive",
        });
        return;
      }

      setSelectedJobForAttachment(job);
      setIsAttachmentDialogOpen(true);
    },
    [attachmentConfig, toast],
  );

  const handleAttachmentUploadSuccess = useCallback(
    (updatedJob: Job) => {
      setJobs((prev) =>
        prev.map((job) => (job.id === updatedJob.id ? updatedJob : job)),
      );
      toast({
        title: "Files uploaded successfully",
        description: "Attachments have been added to the job",
        variant: "default",
      });
    },
    [toast],
  );

  const handleCloseAttachmentDialog = useCallback(() => {
    setIsAttachmentDialogOpen(false);
    setSelectedJobForAttachment(null);
  }, []);

  // Mobile card fields configuration
  const jobMobileFields = [
    {
      key: "date",
      label: "Date",
      isTitle: true,
      render: (value: unknown) =>
        format(parseISO(value as string), "dd/MM/yyyy (EEE)"),
    },
    {
      key: "customer",
      label: "Customer",
      isSubtitle: true,
    },
    {
      key: "driver",
      label: "Driver",
      className: "font-medium",
    },
    {
      key: "truckType",
      label: "Truck Type",
      isBadge: true,
    },
    {
      key: "runsheet",
      label: "Runsheet",
      isCheckbox: true,
      onCheckboxChange: (job: unknown, value: boolean) => {
        updateStatus((job as Job).id, "runsheet", value);
      },
    },
    {
      key: "invoiced",
      label: "Invoiced",
      isCheckbox: true,
      onCheckboxChange: (job: unknown, value: boolean) => {
        updateStatus((job as Job).id, "invoiced", value);
      },
    },
  ];

  // Expandable detail fields configuration
  const jobExpandableFields = [
    {
      key: "billTo",
      label: "Bill To",
      hideIfEmpty: true,
    },
    {
      key: "registration",
      label: "Registration",
      hideIfEmpty: true,
    },
    {
      key: "pickup",
      label: "Pickup Location",
      hideIfEmpty: true,
    },
    {
      key: "dropoff",
      label: "Dropoff Location",
      hideIfEmpty: true,
    },
    {
      key: "startTime",
      label: "Start Time",
      render: (value: unknown) =>
        value ? format(new Date(value as string), "HH:mm") : "Not set",
      hideIfEmpty: true,
    },
    {
      key: "finishTime",
      label: "Finish Time",
      render: (value: unknown) =>
        value ? format(new Date(value as string), "HH:mm") : "Not set",
      hideIfEmpty: true,
    },
    {
      key: "chargedHours",
      label: "Charged Hours",
      render: (value: unknown) => (value ? `${value} hours` : "Not calculated"),
      hideIfEmpty: true,
    },
    {
      key: "driverCharge",
      label: "Driver Charge",
      render: (value: unknown) => (value ? `$${value}` : "Not set"),
      hideIfEmpty: true,
    },
    {
      key: "jobReference",
      label: "Job Reference",
      hideIfEmpty: true,
    },
    {
      key: "eastlink",
      label: "Eastlink",
      render: (value: unknown) =>
        value ? `${value} toll${value !== 1 ? "s" : ""}` : "0",
      hideIfEmpty: true,
    },
    {
      key: "citylink",
      label: "Citylink",
      render: (value: unknown) =>
        value ? `${value} toll${value !== 1 ? "s" : ""}` : "0",
      hideIfEmpty: true,
    },
    {
      key: "comments",
      label: "Comments",
      hideIfEmpty: true,
      className: "break-words whitespace-pre-wrap",
    },
    {
      key: "attachments",
      label: "Attachments",
      className: "max-w-full overflow-hidden",
      render: (value: unknown, item: unknown) => {
        const job = item as Job;
        const hasAttachments =
          job.attachmentRunsheet.length > 0 ||
          job.attachmentDocket.length > 0 ||
          job.attachmentDeliveryPhotos.length > 0;

        if (!hasAttachments) {
          return "No attachments";
        }

        // Mobile-friendly attachment summary
        const totalAttachments =
          job.attachmentRunsheet.length +
          job.attachmentDocket.length +
          job.attachmentDeliveryPhotos.length;

        return (
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-1">
              <span className="font-medium">
                {totalAttachments} file{totalAttachments !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
              {job.attachmentRunsheet.length > 0 && (
                <span>• Runsheet: {job.attachmentRunsheet.length}</span>
              )}
              {job.attachmentDocket.length > 0 && (
                <span>• Docket: {job.attachmentDocket.length}</span>
              )}
              {job.attachmentDeliveryPhotos.length > 0 && (
                <span>• Photos: {job.attachmentDeliveryPhotos.length}</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Tap &quot;Attach Files&quot; to view/manage
            </div>
          </div>
        );
      },
    },
  ];

  const updateStatus = useCallback(
    async (id: number, field: "runsheet" | "invoiced", value: boolean) => {
      try {
        const response = await fetch(`/api/jobs/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });

        if (response.ok) {
          const updatedJob = await response.json();
          setJobs((prev) =>
            prev.map((job) => (job.id === updatedJob.id ? updatedJob : job)),
          );
        } else {
          console.error("Failed to update status");
          alert("Failed to update status. Please try again.");
        }
      } catch (error) {
        console.error("Error updating status:", error);
        alert("Error updating status. Please try again.");
      }
    },
    [],
  );

  return (
    <ProtectedLayout>
      <div className="flex flex-col h-full w-full overflow-hidden">
        <PageControls
          type="jobs"
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          weekEnding={weekEnding}
          years={years}
          months={months}
          weekEndings={weekEndings}
          onYearChange={setSelectedYear}
          onMonthChange={setSelectedMonth}
          onWeekEndingChange={setWeekEnding}
        />
        <div className="flex-1 overflow-y-auto">
          <div>
            <JobsUnifiedDataTable
              data={filteredJobs}
              columns={jobColumns(
                startEdit,
                deleteJob,
                isLoading,
                updateStatus,
                handleAttachFiles,
              ).filter(column => {
                // Remove problematic columns that cause phantom gaps
                const hiddenColumns = ['runsheet', 'invoiced', 'driverCharge', 'eastlink', 'citylink', 'jobReference', 'tolls'];
                if ('accessorKey' in column && hiddenColumns.includes(column.accessorKey as string)) {
                  return false;
                }
                return true;
              })}
              sheetFields={createJobSheetFields(fetchJobs)}
              mobileFields={jobMobileFields}
              expandableFields={jobExpandableFields}
              getItemId={(job) => job.id}
              isLoading={isLoading}
              onEdit={startEdit}
              onDelete={deleteJob}
              onMultiDelete={deleteMultipleJobs}
              onMarkAsInvoiced={markJobsAsInvoiced}
              onAttachFiles={handleAttachFiles}
              onAdd={addEntry}
              onImportSuccess={fetchJobs}
              ToolbarComponent={JobDataTableToolbar}
              filters={{
                startDate:
                  weekEnding instanceof Date
                    ? startOfWeek(weekEnding, { weekStartsOn: 1 })
                        .toISOString()
                        .split("T")[0]
                    : undefined,
                endDate:
                  weekEnding instanceof Date
                    ? endOfWeek(weekEnding, { weekStartsOn: 1 })
                        .toISOString()
                        .split("T")[0]
                    : undefined,
                // Include month filter when showing whole month
                month:
                  weekEnding === SHOW_MONTH
                    ? selectedMonth.toString()
                    : undefined,
                year:
                  weekEnding === SHOW_MONTH
                    ? selectedYear.toString()
                    : undefined,
              }}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
            />
          </div>
        </div>
        <JobForm
          isOpen={isFormOpen}
          onClose={cancelEdit}
          onSave={saveEdit}
          job={editingJob}
          isLoading={isSubmitting}
        />

        {/* Attachment Upload Dialog */}
        {selectedJobForAttachment && attachmentConfig && (
          <JobAttachmentUpload
            isOpen={isAttachmentDialogOpen}
            onClose={handleCloseAttachmentDialog}
            job={selectedJobForAttachment}
            baseFolderId={attachmentConfig.baseFolderId}
            driveId={attachmentConfig.driveId}
            onUploadSuccess={handleAttachmentUploadSuccess}
            onAttachmentDeleted={fetchJobs}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          title={
            jobsToDelete.length > 1 ? "Delete Multiple Jobs" : "Delete Job"
          }
          description={
            jobsToDelete.length > 1
              ? `Are you sure you want to delete ${jobsToDelete.length} jobs? This action cannot be undone.`
              : "Are you sure you want to delete this job? This action cannot be undone."
          }
          itemName={
            jobsToDelete.length === 1 && jobsToDelete[0]
              ? `${new Date(jobsToDelete[0].date).toLocaleDateString()} - ${jobsToDelete[0].customer}`
              : undefined
          }
          isLoading={isDeleting}
        />

        {/* Mark as Invoiced Progress Dialog */}
        <ProgressDialog
          open={isMarkingInvoiced}
          title="Marking Jobs as Invoiced"
          description="Please wait while we update the invoiced status of the selected jobs..."
          icon={<FileCheck className="h-6 w-6 text-green-600" />}
        />
      </div>
    </ProtectedLayout>
  );
}
