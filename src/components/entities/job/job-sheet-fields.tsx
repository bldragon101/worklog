import { SheetField } from "@/components/data-table/core/types";
import { Job } from "@/lib/types";
import { format } from "date-fns";
import { JobAttachmentViewer } from "@/components/ui/job-attachment-viewer";
import { extractTimeFromISO } from "@/lib/utils/time-utils";
import { getTotalDriverHours } from "@/lib/utils/rcti-calculations";

export const createJobSheetFields = (
  onAttachmentDeleted?: () => void,
): SheetField<Job>[] => [
  {
    id: "id",
    label: "ID",
    type: "readonly",
  },
  {
    id: "date",
    label: "Date",
    component: ({ date }) => (
      <span>{format(new Date(date), "dd/MM/yyyy")}</span>
    ),
  },
  {
    id: "driver",
    label: "Driver",
  },
  {
    id: "customer",
    label: "Customer",
  },
  {
    id: "billTo",
    label: "Bill To",
  },
  {
    id: "registration",
    label: "Registration",
  },
  {
    id: "truckType",
    label: "Truck Type",
  },
  {
    id: "pickup",
    label: "Pickup",
  },
  {
    id: "dropoff",
    label: "Dropoff",
  },
  {
    id: "jobReference",
    label: "Job Reference",
    component: ({ jobReference }) => <span>{jobReference || "N/A"}</span>,
  },
  {
    id: "runsheet",
    label: "Runsheet",
    component: ({ runsheet }) => (
      <span>{runsheet === null ? "No" : runsheet ? "Yes" : "No"}</span>
    ),
  },
  {
    id: "invoiced",
    label: "Invoiced",
    component: ({ invoiced }) => (
      <span>{invoiced === null ? "No" : invoiced ? "Yes" : "No"}</span>
    ),
  },
  {
    id: "driverOnly",
    label: "Driver Only (No Charge)",
    component: ({ driverOnly }) => <span>{driverOnly ? "Yes" : "No"}</span>,
  },
  {
    id: "startTime",
    label: "Start Time",
    component: ({ startTime }) => (
      <span>{extractTimeFromISO(startTime) || "N/A"}</span>
    ),
  },
  {
    id: "finishTime",
    label: "Finish Time",
    component: ({ finishTime }) => (
      <span>{extractTimeFromISO(finishTime) || "N/A"}</span>
    ),
  },
  {
    id: "chargedHours",
    label: "Charged Hours",
    component: ({ chargedHours }) => <span>{chargedHours || "N/A"}</span>,
  },
  {
    id: "travelTimeHours",
    label: "Travel Hours",
    component: ({ travelTimeHours }) => (
      <span>{travelTimeHours != null ? travelTimeHours : "N/A"}</span>
    ),
  },
  {
    id: "deductionHours",
    label: "Deduction Hours",
    component: ({ deductionHours }) => (
      <span>{deductionHours != null ? deductionHours : "N/A"}</span>
    ),
  },
  {
    id: "driverCharge",
    label: "Driver Hours",
    component: (job) => (
      <span>
        {getTotalDriverHours({
          chargedHours: job.chargedHours,
          travelTimeHours: job.travelTimeHours,
          driverCharge: job.driverCharge,
          deductionHours: job.deductionHours,
        }).toFixed(2)}
      </span>
    ),
  },
  {
    id: "eastlink",
    label: "Eastlink",
    component: ({ eastlink }) => <span>{eastlink || "0"}</span>,
  },
  {
    id: "citylink",
    label: "Citylink",
    component: ({ citylink }) => <span>{citylink || "0"}</span>,
  },
  {
    id: "comments",
    label: "Comments",
    component: ({ comments }) => (
      <span className="break-words whitespace-pre-wrap text-left block">
        {comments || "N/A"}
      </span>
    ),
  },
  {
    id: "attachmentRunsheet",
    label: "Attachments",
    component: (job: Job) => (
      <JobAttachmentViewer
        attachments={{
          runsheet: job.attachmentRunsheet || [],
          docket: job.attachmentDocket || [],
          delivery_photos: job.attachmentDeliveryPhotos || [],
        }}
        jobId={job.id}
        onAttachmentDeleted={onAttachmentDeleted}
      />
    ),
  },
];

// Keep backward compatibility
export const jobSheetFields = createJobSheetFields();
