"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { Job } from "@/lib/types";
import { MultiSuburbCombobox } from "@/components/shared/multi-suburb-combobox";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { TimePicker } from "@/components/ui/time-picker";
import { JobAttachmentUpload } from "@/components/ui/job-attachment-upload";
import { JobAttachmentViewer } from "@/components/ui/job-attachment-viewer";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Paperclip } from "lucide-react";
import { useJobFormData } from "@/hooks/use-job-form-data";
import { useJobFormOptions } from "@/hooks/use-job-form-options";
import { useJobAttachments } from "@/hooks/use-job-attachments";
import { useJobFormValidation } from "@/hooks/use-job-form-validation";

type JobFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (job: Partial<Job>) => void;
  job: Partial<Job> | null;
  isLoading?: boolean;
};

// Helper functions to convert between arrays and comma-separated strings
const stringToArray = (str: string | undefined): string[] => {
  if (!str || str.trim() === "") return [];
  return str
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

const arrayToString = (arr: string[]): string => {
  return arr.filter((s) => s.length > 0).join(", ");
};

export function JobForm({
  isOpen,
  onClose,
  onSave,
  job,
  isLoading = false,
}: JobFormProps) {
  const { toast } = useToast();

  // Custom hooks for logic separation
  const { formData, setFormData, hasUnsavedChanges, setHasUnsavedChanges } =
    useJobFormData(job);
  const {
    customerOptions,
    billToOptions,
    registrationOptions,
    truckTypeOptions,
    driverOptions,
    selectsLoading,
    customerToBillTo,
    registrationToType,
    driverToTruck,
  } = useJobFormOptions(isOpen);
  const {
    isAttachmentDialogOpen,
    setIsAttachmentDialogOpen,
    attachmentConfig,
  } = useJobAttachments(isOpen);
  const {
    showValidationDialog,
    setShowValidationDialog,
    missingFields,
    showCloseConfirmation,
    setShowCloseConfirmation,
    handleSubmit,
    handleCloseAttempt,
    confirmClose,
  } = useJobFormValidation();

  const [calendarOpen, setCalendarOpen] = React.useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === "checkbox";
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev: Partial<Job>) => ({
      ...prev,
      [name]: isCheckbox ? checked : value,
    }));
  };

  // Close handlers using the validation hook
  const onCloseAttempt = () => {
    handleCloseAttempt(hasUnsavedChanges, onClose);
  };

  const onConfirmClose = () => {
    confirmClose(onClose, setHasUnsavedChanges);
  };

  const onCancelClose = () => {
    setShowCloseConfirmation(false);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: Partial<Job>) => ({
      ...prev,
      [name]: value ? Math.max(0, parseFloat(value) || 0) : null,
    }));
  };

  const handleDateChange = (date: Date | undefined) => {
    setFormData((prev: Partial<Job>) => ({
      ...prev,
      date: date
        ? format(date, "yyyy-MM-dd")
        : prev.date || new Date().toISOString().split("T")[0],
    }));
    setCalendarOpen(false);
  };

  const handleCustomerChange = (customerValue: string) => {
    setFormData((prev: Partial<Job>) => {
      const updatedData = { ...prev, customer: customerValue };

      // Auto-populate bill to if available and not already set by user
      if (customerValue && customerToBillTo[customerValue] && !prev.billTo) {
        updatedData.billTo = customerToBillTo[customerValue];
      }

      return updatedData;
    });
  };

  const handleDriverChange = (driverValue: string) => {
    setFormData((prev: Partial<Job>) => {
      const updatedData = { ...prev, driver: driverValue };

      // Auto-populate registration if available and not already set by user
      if (driverValue && driverToTruck[driverValue] && !prev.registration) {
        updatedData.registration = driverToTruck[driverValue];

        // Also auto-populate truck type if registration has a type mapping and not already set
        const truckRegistration = driverToTruck[driverValue];
        if (
          truckRegistration &&
          registrationToType[truckRegistration] &&
          !prev.truckType
        ) {
          updatedData.truckType = registrationToType[truckRegistration];
        }
      }

      return updatedData;
    });
  };

  const handleRegistrationChange = (registrationValue: string) => {
    setFormData((prev: Partial<Job>) => {
      const updatedData = { ...prev, registration: registrationValue };

      // Auto-populate truck type if available and not already set by user
      if (
        registrationValue &&
        registrationToType[registrationValue] &&
        !prev.truckType
      ) {
        updatedData.truckType = registrationToType[registrationValue];
      }

      return updatedData;
    });
  };

  const handlePickupChange = (pickupArray: string[]) => {
    setFormData((prev: Partial<Job>) => ({
      ...prev,
      pickup: arrayToString(pickupArray),
    }));
  };

  const handleDropoffChange = (dropoffArray: string[]) => {
    setFormData((prev: Partial<Job>) => ({
      ...prev,
      dropoff: arrayToString(dropoffArray),
    }));
  };

  const handleTimeChange = (
    name: "startTime" | "finishTime",
    value: string,
  ) => {
    setFormData((prev: Partial<Job>) => {
      // Store the time string directly for now - we'll convert on save
      const updatedData = { ...prev, [name]: value || null };

      // Auto-calculate charged hours if both times are provided
      const startTimeValue =
        name === "startTime" ? value : (prev.startTime as string);
      const finishTimeValue =
        name === "finishTime" ? value : (prev.finishTime as string);

      if (startTimeValue && finishTimeValue) {
        const start = new Date(
          `1970-01-01T${startTimeValue.padStart(5, "0")}:00`,
        );
        const finish = new Date(
          `1970-01-01T${finishTimeValue.padStart(5, "0")}:00`,
        );

        // Handle overnight shifts
        if (finish < start) {
          finish.setDate(finish.getDate() + 1);
        }

        const diffMs = finish.getTime() - start.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours > 0) {
          updatedData.chargedHours = Math.round(diffHours * 100) / 100; // Round to 2 decimal places
        }
      }

      return updatedData;
    });

    // Mark as having unsaved changes
    setHasUnsavedChanges(true);
  };

  // Attachment handlers
  const handleAttachFiles = () => {
    if (!attachmentConfig) {
      toast({
        title: "Configuration Required",
        description:
          "Google Drive configuration is required for file attachments. Please check the integrations page.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.id) {
      toast({
        title: "Save Job First",
        description: "Please save the job before adding attachments.",
        variant: "destructive",
      });
      return;
    }

    setIsAttachmentDialogOpen(true);
  };

  const handleAttachmentUploadSuccess = (updatedJob: Job) => {
    setFormData((prev) => ({
      ...prev,
      attachmentRunsheet: updatedJob.attachmentRunsheet,
      attachmentDocket: updatedJob.attachmentDocket,
      attachmentDeliveryPhotos: updatedJob.attachmentDeliveryPhotos,
      runsheet: updatedJob.runsheet,
      invoiced: updatedJob.invoiced,
    }));
    toast({
      title: "Files uploaded successfully",
      description: "Attachments have been added to the job",
      variant: "default",
    });
  };

  const handleAttachmentDeleted = async () => {
    // Refresh job data from server after deletion
    if (formData.id) {
      try {
        const response = await fetch(`/api/jobs/${formData.id}`);
        if (response.ok) {
          const updatedJob = await response.json();
          setFormData((prev) => ({
            ...prev,
            attachmentRunsheet: updatedJob.attachmentRunsheet,
            attachmentDocket: updatedJob.attachmentDocket,
            attachmentDeliveryPhotos: updatedJob.attachmentDeliveryPhotos,
          }));

          // Note: We don't show a toast here since the JobAttachmentViewer
          // will handle showing specific success/warning messages
        }
      } catch (error) {
        console.error("Failed to refresh job data after deletion:", error);
        toast({
          title: "Warning",
          description:
            "Attachment was processed but data may not be up to date. Please refresh the page.",
          variant: "destructive",
        });
      }
    }
  };

  const handleCloseAttachmentDialog = () => {
    setIsAttachmentDialogOpen(false);
  };

  // Check if job has any attachments
  const hasAttachments =
    formData.attachmentRunsheet?.length ||
    formData.attachmentDocket?.length ||
    formData.attachmentDeliveryPhotos?.length;
  return (
    <Dialog open={isOpen} onOpenChange={onCloseAttempt}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{job?.id ? "Edit" : "Add"} Job</DialogTitle>
          <DialogDescription>
            {job?.id
              ? "Make changes to your job here."
              : "Add a new job to your records."}{" "}
            Click save when you&#39;re done.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Job Details</TabsTrigger>
            <TabsTrigger
              value="attachments"
              className="flex items-center gap-2"
            >
              <Paperclip className="h-4 w-4" />
              Attachments
              {hasAttachments && (
                <span className="ml-1 bg-primary text-primary-foreground text-xs rounded px-1.5 py-0.5">
                  {(formData.attachmentRunsheet?.length || 0) +
                    (formData.attachmentDocket?.length || 0) +
                    (formData.attachmentDeliveryPhotos?.length || 0)}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="details"
            className="overflow-y-auto max-h-[500px] pr-2"
          >
            <div className="space-y-4 py-4">
              {/* Row 1 - Date, Driver, Truck Type */}
              <div className="grid grid-cols-3 gap-3 min-w-0 overflow-hidden">
                <div className="grid gap-1.5 min-w-0">
                  <label htmlFor="date" className="text-xs font-medium">
                    Date <span className="text-destructive">*</span>
                  </label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={isLoading}
                        className="justify-start h-9 text-sm"
                      >
                        {formData.date
                          ? format(parseISO(formData.date), "dd/MM/yy")
                          : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={
                          formData.date ? parseISO(formData.date) : undefined
                        }
                        onSelect={handleDateChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-1.5 min-w-0 overflow-hidden">
                  <label
                    htmlFor="driver-select"
                    className="text-xs font-medium"
                  >
                    Driver <span className="text-destructive">*</span>
                  </label>
                  <SearchableSelect
                    id="driver-select"
                    value={formData.driver || ""}
                    onChange={handleDriverChange}
                    options={driverOptions}
                    placeholder="Select driver"
                    className="w-full h-9 min-w-0"
                    disabled={isLoading}
                    loading={selectsLoading}
                  />
                </div>

                <div className="grid gap-1.5 min-w-0 overflow-hidden">
                  <label
                    htmlFor="trucktype-select"
                    className="text-xs font-medium"
                  >
                    Truck Type <span className="text-destructive">*</span>
                  </label>
                  <SearchableSelect
                    id="trucktype-select"
                    value={formData.truckType || ""}
                    onChange={(value) =>
                      setFormData((prev: Partial<Job>) => ({
                        ...prev,
                        truckType: value,
                      }))
                    }
                    options={truckTypeOptions}
                    placeholder="Select type"
                    className="w-full h-9 min-w-0"
                    disabled={isLoading}
                    loading={selectsLoading}
                  />
                </div>
              </div>

              {/* Row 2 - Customer, Bill To, Registration */}
              <div className="grid grid-cols-3 gap-3 min-w-0 overflow-hidden">
                <div className="grid gap-1.5 min-w-0 overflow-hidden">
                  <label
                    htmlFor="customer-select"
                    className="text-xs font-medium"
                  >
                    Customer <span className="text-destructive">*</span>
                  </label>
                  <SearchableSelect
                    id="customer-select"
                    value={formData.customer || ""}
                    onChange={handleCustomerChange}
                    options={customerOptions}
                    placeholder="Select customer"
                    className="w-full h-9 min-w-0"
                    disabled={isLoading}
                    loading={selectsLoading}
                  />
                </div>

                <div className="grid gap-1.5 min-w-0 overflow-hidden">
                  <label
                    htmlFor="billto-select"
                    className="text-xs font-medium"
                  >
                    Bill To <span className="text-destructive">*</span>
                  </label>
                  <SearchableSelect
                    id="billto-select"
                    value={formData.billTo || ""}
                    onChange={(value) =>
                      setFormData((prev: Partial<Job>) => ({
                        ...prev,
                        billTo: value,
                      }))
                    }
                    options={billToOptions}
                    placeholder="Select bill to"
                    className="w-full h-9 min-w-0"
                    disabled={isLoading}
                    loading={selectsLoading}
                  />
                </div>

                <div className="grid gap-1.5 min-w-0 overflow-hidden">
                  <label
                    htmlFor="registration-select"
                    className="text-xs font-medium"
                  >
                    Registration <span className="text-destructive">*</span>
                  </label>
                  <SearchableSelect
                    id="registration-select"
                    value={formData.registration || ""}
                    onChange={handleRegistrationChange}
                    options={registrationOptions}
                    placeholder="Select reg"
                    className="w-full h-9 min-w-0"
                    disabled={isLoading}
                    loading={selectsLoading}
                  />
                </div>
              </div>

              {/* Row 3 - Job Reference, Pickup, Dropoff */}
              <div className="grid grid-cols-3 gap-3 min-w-0 overflow-hidden">
                <div className="grid gap-1.5 min-w-0">
                  <label htmlFor="jobReference" className="text-xs font-medium">
                    Job Reference
                  </label>
                  <Input
                    id="jobReference"
                    name="jobReference"
                    value={formData.jobReference || ""}
                    onChange={handleChange}
                    disabled={isLoading}
                    placeholder="Job reference"
                    className="h-9 text-sm w-full max-w-full overflow-hidden text-ellipsis"
                  />
                </div>

                <div className="grid gap-1.5 min-w-0 overflow-hidden">
                  <label htmlFor="pickup" className="text-xs font-medium">
                    Pick up <span className="text-destructive">*</span>
                  </label>
                  <MultiSuburbCombobox
                    id="pickup"
                    values={stringToArray(formData.pickup)}
                    onChange={handlePickupChange}
                    placeholder="Search pickup suburbs"
                    className="w-full min-w-0"
                    disabled={isLoading}
                  />
                </div>

                <div className="grid gap-1.5 min-w-0 overflow-hidden">
                  <label htmlFor="dropoff" className="text-xs font-medium">
                    Drop off
                  </label>
                  <MultiSuburbCombobox
                    id="dropoff"
                    values={stringToArray(formData.dropoff)}
                    onChange={handleDropoffChange}
                    placeholder="Search dropoff suburbs"
                    className="w-full min-w-0"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Times & Money */}
              <div className="grid grid-cols-2 gap-3 min-w-0">
                <div className="grid gap-1.5">
                  <label htmlFor="start-time" className="text-xs font-medium">
                    Start Time
                  </label>
                  <TimePicker
                    id="start-time"
                    value={(formData.startTime as string) || ""}
                    onChange={(value) => handleTimeChange("startTime", value)}
                    disabled={isLoading}
                    placeholder="Start time"
                  />
                </div>

                <div className="grid gap-1.5">
                  <label htmlFor="finish-time" className="text-xs font-medium">
                    Finish Time
                  </label>
                  <TimePicker
                    id="finish-time"
                    value={(formData.finishTime as string) || ""}
                    onChange={(value) => handleTimeChange("finishTime", value)}
                    disabled={isLoading}
                    placeholder="Finish time"
                  />
                </div>

                <div className="grid gap-1.5">
                  <label htmlFor="chargedHours" className="text-xs font-medium">
                    Hours
                  </label>
                  <Input
                    id="chargedHours"
                    name="chargedHours"
                    type="number"
                    step="0.01"
                    value={formData.chargedHours || ""}
                    onChange={handleNumberChange}
                    disabled={isLoading}
                    className={`h-9 text-sm w-full max-w-full overflow-hidden ${formData.startTime && formData.finishTime ? "bg-muted/30" : ""}`}
                    placeholder="0"
                  />
                </div>

                <div className="grid gap-1.5">
                  <label htmlFor="driverCharge" className="text-xs font-medium">
                    Driver Charge
                  </label>
                  <Input
                    id="driverCharge"
                    name="driverCharge"
                    type="number"
                    step="0.01"
                    value={formData.driverCharge || ""}
                    onChange={handleNumberChange}
                    disabled={isLoading}
                    placeholder="0.00"
                    className="h-9 text-sm w-full max-w-full overflow-hidden"
                  />
                </div>

                <div className="grid gap-1.5">
                  <label
                    htmlFor="eastlink-select"
                    className="text-xs font-medium"
                  >
                    Eastlink
                  </label>
                  <SearchableSelect
                    id="eastlink-select"
                    value={formData.eastlink?.toString() || ""}
                    onChange={(value) =>
                      setFormData((prev: Partial<Job>) => ({
                        ...prev,
                        eastlink: value ? Math.max(0, parseInt(value) || 0) : null,
                      }))
                    }
                    options={[
                      "0",
                      "1",
                      "2",
                      "3",
                      "4",
                      "5",
                      "6",
                      "7",
                      "8",
                      "9",
                      "10",
                    ]}
                    placeholder="Number of trips"
                    className="h-9 text-sm w-full max-w-full"
                    disabled={isLoading}
                  />
                </div>

                <div className="grid gap-1.5">
                  <label
                    htmlFor="citylink-select"
                    className="text-xs font-medium"
                  >
                    Citylink
                  </label>
                  <SearchableSelect
                    id="citylink-select"
                    value={formData.citylink?.toString() || ""}
                    onChange={(value) =>
                      setFormData((prev: Partial<Job>) => ({
                        ...prev,
                        citylink: value ? Math.max(0, parseInt(value) || 0) : null,
                      }))
                    }
                    options={[
                      "0",
                      "1",
                      "2",
                      "3",
                      "4",
                      "5",
                      "6",
                      "7",
                      "8",
                      "9",
                      "10",
                    ]}
                    placeholder="Number of trips"
                    className="h-9 text-sm w-full max-w-full"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Status & Comments */}
              <div className="space-y-3">
                <div className="flex items-center gap-4 px-3 py-2 bg-muted/30 rounded">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="runsheet"
                      name="runsheet"
                      checked={formData.runsheet || false}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="w-3.5 h-3.5"
                    />
                    <label
                      htmlFor="runsheet"
                      className="text-xs font-medium cursor-pointer"
                    >
                      Runsheet
                    </label>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="invoiced"
                      name="invoiced"
                      checked={formData.invoiced || false}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="w-3.5 h-3.5"
                    />
                    <label
                      htmlFor="invoiced"
                      className="text-xs font-medium cursor-pointer"
                    >
                      Invoiced
                    </label>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <label htmlFor="comments" className="text-xs font-medium">
                    Comments
                  </label>
                  <Textarea
                    id="comments"
                    name="comments"
                    value={formData.comments || ""}
                    onChange={handleChange}
                    disabled={isLoading}
                    placeholder="Job notes..."
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="attachments"
            className="overflow-y-auto max-h-[500px] pr-2"
          >
            <div className="space-y-4 py-4">
              {formData.id ? (
                <>
                  {/* Existing Attachments Viewer */}
                  <JobAttachmentViewer
                    attachments={{
                      runsheet: formData.attachmentRunsheet || [],
                      docket: formData.attachmentDocket || [],
                      delivery_photos: formData.attachmentDeliveryPhotos || [],
                    }}
                    jobId={formData.id}
                    onAttachmentDeleted={handleAttachmentDeleted}
                    driveId={attachmentConfig?.driveId}
                  />

                  {/* Upload New Attachments Button */}
                  <div className="border-t pt-4">
                    <Button
                      onClick={handleAttachFiles}
                      variant="outline"
                      className="w-full flex items-center gap-2"
                      disabled={!attachmentConfig}
                      id="add-attachments-btn"
                    >
                      <Paperclip className="h-4 w-4" />
                      Add Attachments
                    </Button>
                    {!attachmentConfig && (
                      <p className="text-sm text-muted-foreground mt-2 text-center">
                        Google Drive configuration required. Please check the
                        integrations page.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Paperclip className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Save Job First</p>
                  <p className="text-sm">
                    Please save the job details before adding attachments.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCloseAttempt}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={() => handleSubmit(formData, onSave, setHasUnsavedChanges)}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </div>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Attachment Upload Dialog */}
      {formData.id && attachmentConfig && (
        <JobAttachmentUpload
          isOpen={isAttachmentDialogOpen}
          onClose={handleCloseAttachmentDialog}
          job={formData as Job}
          baseFolderId={attachmentConfig.baseFolderId}
          driveId={attachmentConfig.driveId}
          onUploadSuccess={handleAttachmentUploadSuccess}
        />
      )}

      {/* Close Confirmation Dialog */}
      <AlertDialog
        open={showCloseConfirmation}
        onOpenChange={setShowCloseConfirmation}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to close this
              form? All changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancelClose}>
              Continue Editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Close Without Saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Validation Dialog */}
      <AlertDialog
        open={showValidationDialog}
        onOpenChange={setShowValidationDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Required Fields Missing</AlertDialogTitle>
            <AlertDialogDescription>
              Please fill in the following required fields before saving:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {missingFields.map((field, index) => (
                <li key={index} className="text-destructive font-medium">
                  {field}
                </li>
              ))}
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowValidationDialog(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
