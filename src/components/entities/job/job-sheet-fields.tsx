import { SheetField } from "@/components/data-table/core/types";
import { Job } from "@/lib/types";
import { format } from "date-fns";
import { JobAttachmentViewer } from "@/components/ui/job-attachment-viewer";
import { extractTimeFromISO } from "@/lib/utils/time-utils";

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
    id: "driverCharge",
    label: "Driver Charge",
    component: ({ driverCharge }) => <span>{driverCharge || "N/A"}</span>,
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
