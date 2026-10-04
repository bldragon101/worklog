"use client";

import { useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Edit,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DropoffWithRegionalBadges } from "@/components/entities/job/dropoff-with-regional-badges";
import { formatShortDate } from "@/components/entities/job/job-mobile-filters";
import { getTotalDriverHours } from "@/lib/utils/rcti-calculations";
import { extractTimeFromISO } from "@/lib/utils/time-utils";
import { cn } from "@/lib/utils/utils";
import type { Job } from "@/lib/types";

type StatusField = "runsheet" | "invoiced";

const STATUS_FIELDS: StatusField[] = ["runsheet", "invoiced"];

interface MobileJobsViewProps {
  jobs: Job[];
  isLoading?: boolean;
  onEdit?: (job: Job) => void;
  onDelete?: (job: Job) => void;
  onAttachFiles?: (job: Job) => void;
  onDuplicate?: (job: Job) => void;
  onUpdateStatus?: (
    id: number,
    field: StatusField,
    value: boolean,
  ) => Promise<void>;
}

interface JobDayGroup {
  isoDate: string;
  jobs: Job[];
  chargedHours: number;
}

/**
 * HH:mm from an ISO datetime string without timezone conversion, or null when
 * the time is not set.
 */
function timeOf({ iso }: { iso: string | null }): string | null {
  return extractTimeFromISO(iso) || null;
}

function formatHours({ hours }: { hours: number | null | undefined }): string {
  return Number(hours ?? 0).toFixed(2);
}

function attachmentCount({ job }: { job: Job }): number {
  return (
    (job.attachmentRunsheet?.length ?? 0) +
    (job.attachmentDocket?.length ?? 0) +
    (job.attachmentDeliveryPhotos?.length ?? 0)
  );
}

/**
 * Group jobs by day (oldest first), ordering each day's jobs by start time
 * and then driver.
 */
function groupJobsByDay({ jobs }: { jobs: Job[] }): JobDayGroup[] {
  const groups = new Map<string, Job[]>();
  for (const job of jobs) {
    const isoDate = job.date.slice(0, 10);
    const dayJobs = groups.get(isoDate);
    if (dayJobs) {
      dayJobs.push(job);
    } else {
      groups.set(isoDate, [job]);
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([isoDate, dayJobs]) => ({
      isoDate,
      jobs: [...dayJobs].sort(
        (a, b) =>
          (timeOf({ iso: a.startTime }) ?? "99:99").localeCompare(
            timeOf({ iso: b.startTime }) ?? "99:99",
          ) || (a.driver ?? "").localeCompare(b.driver ?? ""),
      ),
      chargedHours: dayJobs.reduce(
        (total, job) => total + Number(job.chargedHours ?? 0),
        0,
      ),
    }));
}

function MobileJobsSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-lg border p-3">
          <div className="flex justify-between">
            <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-5 w-12 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
            <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusToggle({
  id,
  label,
  checked,
  isPending,
  disabled,
  onToggle,
}: {
  id: string;
  label: string;
  checked: boolean;
  isPending: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      aria-pressed={checked}
      disabled={disabled || isPending}
      onClick={onToggle}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-60",
        checked
          ? "border-green-600/30 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-950/40 dark:text-green-300"
          : "border-dashed text-muted-foreground",
      )}
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Check
          className={cn("h-3.5 w-3.5", checked ? "opacity-100" : "opacity-30")}
          aria-hidden="true"
        />
      )}
      {label}
    </button>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function JobDetails({ job }: { job: Job }) {
  const driverHours = getTotalDriverHours({
    chargedHours: job.chargedHours,
    travelTimeHours: job.travelTimeHours,
    driverCharge: job.driverCharge,
    deductionHours: job.deductionHours,
  });
  const attachments = [
    { label: "Runsheet", count: job.attachmentRunsheet?.length ?? 0 },
    { label: "Docket", count: job.attachmentDocket?.length ?? 0 },
    { label: "Photos", count: job.attachmentDeliveryPhotos?.length ?? 0 },
  ].filter((attachment) => attachment.count > 0);

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t px-3 py-3 text-sm">
      {job.billTo && <DetailRow label="Bill to">{job.billTo}</DetailRow>}
      {job.pickup && <DetailRow label="Pickup">{job.pickup}</DetailRow>}
      {job.dropoff && (
        <DetailRow label="Dropoff">
          <DropoffWithRegionalBadges pickup={job.pickup} dropoff={job.dropoff} />
        </DetailRow>
      )}
      <DetailRow label="Charged">{formatHours({ hours: job.chargedHours })} h</DetailRow>
      <DetailRow label="Driver hours">{driverHours.toFixed(2)} h</DetailRow>
      {job.travelTimeHours != null && Number(job.travelTimeHours) > 0 && (
        <DetailRow label="Travel">
          {formatHours({ hours: job.travelTimeHours })} h
        </DetailRow>
      )}
      {job.deductionHours != null && Number(job.deductionHours) > 0 && (
        <DetailRow label="Deduction">
          {formatHours({ hours: job.deductionHours })} h
        </DetailRow>
      )}
      {job.driverOnly && <DetailRow label="Driver only">No charge</DetailRow>}
      {job.jobReference && (
        <DetailRow label="Reference">{job.jobReference}</DetailRow>
      )}
      {(Number(job.eastlink ?? 0) > 0 || Number(job.citylink ?? 0) > 0) && (
        <DetailRow label="Tolls">
          {[
            Number(job.eastlink ?? 0) > 0 ? `Eastlink ${job.eastlink}` : null,
            Number(job.citylink ?? 0) > 0 ? `Citylink ${job.citylink}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </DetailRow>
      )}
      {attachments.length > 0 && (
        <DetailRow label="Files">
          {attachments
            .map((attachment) => `${attachment.label} ${attachment.count}`)
            .join(" · ")}
        </DetailRow>
      )}
      {job.comments && (
        <DetailRow label="Comments">
          <span className="whitespace-pre-wrap">{job.comments}</span>
        </DetailRow>
      )}
    </dl>
  );
}

function MobileJobCard({
  job,
  isExpanded,
  pendingFields,
  onToggleExpanded,
  onToggleStatus,
  onEdit,
  onDelete,
  onAttachFiles,
  onDuplicate,
}: {
  job: Job;
  isExpanded: boolean;
  pendingFields: StatusField[];
  onToggleExpanded: () => void;
  onToggleStatus?: (field: StatusField) => void;
  onEdit?: (job: Job) => void;
  onDelete?: (job: Job) => void;
  onAttachFiles?: (job: Job) => void;
  onDuplicate?: (job: Job) => void;
}) {
  const start = timeOf({ iso: job.startTime });
  const finish = timeOf({ iso: job.finishTime });
  const files = attachmentCount({ job });
  const route = [job.pickup, job.dropoff].filter(Boolean).join(" → ");
  const hasMenu = Boolean(onAttachFiles || onDuplicate || onDelete);

  return (
    <article
      className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs"
      aria-label={`${job.driver || "Unassigned"} for ${job.customer || "no customer"}`}
    >
      <button
        id={`mobile-job-${job.id}-toggle-btn`}
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={isExpanded}
        aria-controls={`mobile-job-${job.id}-details`}
        className="block w-full px-3 pt-3 pb-2 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {job.driver || "No driver"}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {job.customer || "No customer"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-sm font-semibold">
              {formatHours({ hours: job.chargedHours })}
              <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                h
              </span>
            </p>
            {(start || finish) && (
              <p className="font-mono text-xs text-muted-foreground">
                {start ?? "--:--"}–{finish ?? "--:--"}
              </p>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {job.truckType && (
            <Badge variant="outline" className="text-xs">
              {job.truckType}
            </Badge>
          )}
          {job.registration && (
            <Badge variant="secondary" className="font-mono text-xs">
              {job.registration}
            </Badge>
          )}
          {files > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Paperclip className="h-3 w-3" aria-hidden="true" />
              {files}
            </span>
          )}
          <ChevronDown
            className={cn(
              "ml-auto h-4 w-4 text-muted-foreground transition-transform",
              isExpanded && "rotate-180",
            )}
            aria-hidden="true"
          />
        </div>

        {route && !isExpanded && (
          <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">
            {route}
          </p>
        )}
      </button>

      {isExpanded && (
        <div id={`mobile-job-${job.id}-details`}>
          <JobDetails job={job} />
        </div>
      )}

      <div className="flex items-center gap-2 border-t bg-muted/30 px-3 py-2">
        <StatusToggle
          id={`mobile-job-${job.id}-runsheet-btn`}
          label="Runsheet"
          checked={Boolean(job.runsheet)}
          isPending={pendingFields.includes("runsheet")}
          disabled={!onToggleStatus}
          onToggle={() => onToggleStatus?.("runsheet")}
        />
        <StatusToggle
          id={`mobile-job-${job.id}-invoiced-btn`}
          label="Invoiced"
          checked={Boolean(job.invoiced)}
          isPending={pendingFields.includes("invoiced")}
          disabled={!onToggleStatus}
          onToggle={() => onToggleStatus?.("invoiced")}
        />
        <div className="ml-auto flex items-center">
          {onEdit && (
            <Button
              id={`mobile-job-${job.id}-edit-btn`}
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onEdit(job)}
              aria-label="Edit job"
            >
              <Edit className="h-4 w-4">
                <title>Edit job</title>
              </Edit>
            </Button>
          )}
          {hasMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  id={`mobile-job-${job.id}-actions-btn`}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="h-4 w-4">
                    <title>More actions</title>
                  </MoreHorizontal>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onAttachFiles && (
                  <DropdownMenuItem
                    id={`mobile-job-${job.id}-attach-files`}
                    onSelect={() => onAttachFiles(job)}
                  >
                    <Paperclip className="mr-2 h-4 w-4" aria-hidden="true" />
                    Attach files
                  </DropdownMenuItem>
                )}
                {onDuplicate && (
                  <DropdownMenuItem
                    id={`mobile-job-${job.id}-duplicate`}
                    onSelect={() => onDuplicate(job)}
                  >
                    <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                    Duplicate
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      id={`mobile-job-${job.id}-delete`}
                      onSelect={() => onDelete(job)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * Phone layout for the jobs list: jobs grouped under sticky day headers, with
 * runsheet and invoiced toggles and actions on each card. Expects the jobs
 * already filtered and searched by the shared table.
 */
export function MobileJobsView({
  jobs,
  isLoading = false,
  onEdit,
  onDelete,
  onAttachFiles,
  onDuplicate,
  onUpdateStatus,
}: MobileJobsViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());

  if (isLoading) return <MobileJobsSkeleton />;

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 px-6 py-16 text-center">
        <p className="font-medium">No jobs found</p>
        <p className="text-sm text-muted-foreground">
          Try another week, or clear your search and filters.
        </p>
      </div>
    );
  }

  const groups = groupJobsByDay({ jobs });
  const totalHours = groups.reduce(
    (total, group) => total + group.chargedHours,
    0,
  );
  const notInvoiced = jobs.filter((job) => !job.invoiced).length;

  const toggleExpanded = ({ id }: { id: number }) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleStatus = async ({
    job,
    field,
  }: {
    job: Job;
    field: StatusField;
  }) => {
    if (!onUpdateStatus) return;
    const key = `${job.id}-${field}`;
    setPending((previous) => new Set(previous).add(key));
    try {
      await onUpdateStatus(job.id, field, !job[field]);
    } finally {
      setPending((previous) => {
        const next = new Set(previous);
        next.delete(key);
        return next;
      });
    }
  };

  return (
    <div className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <p className="px-4 pt-3 pb-1 text-xs text-muted-foreground">
        {jobs.length} job{jobs.length === 1 ? "" : "s"} ·{" "}
        {totalHours.toFixed(2)} h charged
        {notInvoiced > 0 && ` · ${notInvoiced} not invoiced`}
      </p>
      {groups.map((group) => (
        <section
          key={group.isoDate}
          aria-labelledby={`mobile-jobs-day-${group.isoDate}`}
        >
          <div className="sticky top-0 z-10 flex items-baseline justify-between border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <h2
              id={`mobile-jobs-day-${group.isoDate}`}
              className="text-sm font-semibold"
            >
              {formatShortDate({ isoDate: group.isoDate })}
            </h2>
            <span className="text-xs text-muted-foreground">
              {group.jobs.length} job{group.jobs.length === 1 ? "" : "s"} ·{" "}
              {group.chargedHours.toFixed(2)} h
            </span>
          </div>
          <div className="space-y-2.5 px-4 py-3">
            {group.jobs.map((job) => (
              <MobileJobCard
                key={job.id}
                job={job}
                isExpanded={expandedIds.has(job.id)}
                pendingFields={STATUS_FIELDS.filter((field) =>
                  pending.has(`${job.id}-${field}`),
                )}
                onToggleExpanded={() => toggleExpanded({ id: job.id })}
                onToggleStatus={
                  onUpdateStatus
                    ? (field) => void toggleStatus({ job, field })
                    : undefined
                }
                onEdit={onEdit}
                onDelete={onDelete}
                onAttachFiles={onAttachFiles}
                onDuplicate={onDuplicate}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
