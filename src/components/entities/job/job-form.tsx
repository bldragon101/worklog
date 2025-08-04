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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { Job } from "@/lib/types";
import { SuburbCombobox } from "@/components/shared/suburb-combobox";
import { SearchableSelect } from "@/components/shared/searchable-select";

type JobFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (job: Partial<Job>) => void;
  job: Partial<Job> | null;
  isLoading?: boolean;
};

export function JobForm({ isOpen, onClose, onSave, job, isLoading = false }: JobFormProps) {
  const [formData, setFormData] = React.useState<Partial<Job>>({});
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  
  // Dynamic select options state
  const [customerOptions, setCustomerOptions] = React.useState<string[]>([]);
  const [billToOptions, setBillToOptions] = React.useState<string[]>([]);
  const [registrationOptions, setRegistrationOptions] = React.useState<string[]>([]);
  const [truckTypeOptions, setTruckTypeOptions] = React.useState<string[]>([]);
  const [selectsLoading, setSelectsLoading] = React.useState(true);

  React.useEffect(() => {
    setFormData(job || {});
  }, [job]);

  // Fetch options for dynamic selects
  React.useEffect(() => {
    const fetchOptions = async () => {
      try {
        setSelectsLoading(true);
        const [customerResponse, vehicleResponse] = await Promise.all([
          fetch('/api/customers/select-options'),
          fetch('/api/vehicles/select-options')
        ]);

        if (customerResponse.ok) {
          const customerData = await customerResponse.json();
          setCustomerOptions(customerData.customerOptions || []);
          setBillToOptions(customerData.billToOptions || []);
        }

        if (vehicleResponse.ok) {
          const vehicleData = await vehicleResponse.json();
          setRegistrationOptions(vehicleData.registrationOptions || []);
          setTruckTypeOptions(vehicleData.truckTypeOptions || []);
        }
      } catch (error) {
        console.error('Error fetching select options:', error);
      } finally {
        setSelectsLoading(false);
      }
    };

    if (isOpen) {
      fetchOptions();
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev: Partial<Job>) => ({ ...prev, [name]: isCheckbox ? checked : value }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: Partial<Job>) => ({ ...prev, [name]: value ? parseFloat(value) : null }));
  };

  const handleDateChange = (date: Date | undefined) => {
    setFormData((prev: Partial<Job>) => ({ ...prev, date: date ? format(date, "yyyy-MM-dd") : undefined }));
    setCalendarOpen(false);
  };

  const handleSubmit = () => {
    if (!isLoading) {
      onSave(formData);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{job?.id ? "Edit" : "Add"} Job</DialogTitle>
          <DialogDescription>
            {job?.id ? "Make changes to your job here." : "Add a new job to your records."} Click save when you&#39;re done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="date">Date</label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" disabled={isLoading}>
                  {formData.date ? format(parseISO(formData.date), "dd-MM-yyyy") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.date ? parseISO(formData.date) : undefined}
                  onSelect={handleDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-2">
            <label htmlFor="driver">Driver</label>
            <Input id="driver" name="driver" value={formData.driver || ""} onChange={handleChange} disabled={isLoading} />
          </div>
          <div className="grid gap-2">
            <label htmlFor="customer-select">Customer</label>
            <SearchableSelect
              id="customer-select"
              value={formData.customer || ""}
              onChange={(value) => setFormData((prev: Partial<Job>) => ({ ...prev, customer: value }))}
              options={customerOptions}
              placeholder="Select customer..."
              className="w-full"
              disabled={isLoading}
              loading={selectsLoading}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="billto-select">Bill To</label>
            <SearchableSelect
              id="billto-select"
              value={formData.billTo || ""}
              onChange={(value) => setFormData((prev: Partial<Job>) => ({ ...prev, billTo: value }))}
              options={billToOptions}
              placeholder="Select bill to..."
              className="w-full"
              disabled={isLoading}
              loading={selectsLoading}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="registration-select">Registration</label>
            <SearchableSelect
              id="registration-select"
              value={formData.registration || ""}
              onChange={(value) => setFormData((prev: Partial<Job>) => ({ ...prev, registration: value }))}
              options={registrationOptions}
              placeholder="Select registration..."
              className="w-full"
              disabled={isLoading}
              loading={selectsLoading}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="trucktype-select">Truck Type</label>
            <SearchableSelect
              id="trucktype-select"
              value={formData.truckType || ""}
              onChange={(value) => setFormData((prev: Partial<Job>) => ({ ...prev, truckType: value }))}
              options={truckTypeOptions}
              placeholder="Select truck type..."
              className="w-full"
              disabled={isLoading}
              loading={selectsLoading}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="pickup">Pick up</label>
            <SuburbCombobox
              value={formData.pickup || ""}
              onChange={(value) => setFormData((prev: Partial<Job>) => ({ ...prev, pickup: value }))}
              placeholder="Search pickup suburb..."
              className="w-full"
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="dropoff">Drop off</label>
            <SuburbCombobox
              value={formData.dropoff || ""}
              onChange={(value) => setFormData((prev: Partial<Job>) => ({ ...prev, dropoff: value }))}
              placeholder="Search dropoff suburb..."
              className="w-full"
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-2 col-span-2">
            <label htmlFor="comments">Comments</label>
            <Textarea id="comments" name="comments" value={formData.comments || ""} onChange={handleChange} disabled={isLoading} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="runsheet" name="runsheet" checked={formData.runsheet || false} onChange={handleChange} disabled={isLoading} />
            <label htmlFor="runsheet">Runsheet</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="invoiced" name="invoiced" checked={formData.invoiced || false} onChange={handleChange} disabled={isLoading} />
            <label htmlFor="invoiced">Invoiced</label>
          </div>
          <div className="grid gap-2">
            <label htmlFor="chargedHours">Charged Hours</label>
            <Input id="chargedHours" name="chargedHours" type="number" value={formData.chargedHours || ""} onChange={handleNumberChange} disabled={isLoading} />
          </div>
          <div className="grid gap-2">
            <label htmlFor="driverCharge">Driver Charge</label>
            <Input id="driverCharge" name="driverCharge" type="number" value={formData.driverCharge || ""} onChange={handleNumberChange} disabled={isLoading} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
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
    </Dialog>
  );
}
