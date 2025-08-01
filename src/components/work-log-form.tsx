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
import { WorkLog } from "@/lib/types";
import { SuburbCombobox } from "./suburb-combobox";

type WorkLogFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: Partial<WorkLog>) => void;
  log: Partial<WorkLog> | null;
  isLoading?: boolean;
};

export function WorkLogForm({ isOpen, onClose, onSave, log, isLoading = false }: WorkLogFormProps) {
  const [formData, setFormData] = React.useState<Partial<WorkLog>>({});
  const [calendarOpen, setCalendarOpen] = React.useState(false);

  React.useEffect(() => {
    setFormData(log || {});
  }, [log]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev: Partial<WorkLog>) => ({ ...prev, [name]: isCheckbox ? checked : value }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: Partial<WorkLog>) => ({ ...prev, [name]: value ? parseFloat(value) : null }));
  };

  const handleDateChange = (date: Date | undefined) => {
    setFormData((prev: Partial<WorkLog>) => ({ ...prev, date: date ? format(date, "yyyy-MM-dd") : undefined }));
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
          <DialogTitle>{log?.id ? "Edit" : "Add"} Work Log</DialogTitle>
          <DialogDescription>
            {log?.id ? "Make changes to your work log here." : "Add a new work log to your records."} Click save when you&#39;re done.
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
            <label htmlFor="customer">Customer</label>
            <Input id="customer" name="customer" value={formData.customer || ""} onChange={handleChange} disabled={isLoading} />
          </div>
          <div className="grid gap-2">
            <label htmlFor="billTo">Bill To</label>
            <Input id="billTo" name="billTo" value={formData.billTo || ""} onChange={handleChange} disabled={isLoading} />
          </div>
          <div className="grid gap-2">
            <label htmlFor="registration">Registration</label>
            <Input id="registration" name="registration" value={formData.registration || ""} onChange={handleChange} disabled={isLoading} />
          </div>
          <div className="grid gap-2">
            <label htmlFor="truckType">Truck Type</label>
            <Input id="truckType" name="truckType" value={formData.truckType || ""} onChange={handleChange} disabled={isLoading} />
          </div>
          <div className="grid gap-2">
            <label htmlFor="pickup">Pick up</label>
            <SuburbCombobox
              value={formData.pickup || ""}
              onChange={(value) => setFormData((prev: Partial<WorkLog>) => ({ ...prev, pickup: value }))}
              placeholder="Search pickup suburb..."
              className="w-full"
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="dropoff">Drop off</label>
            <SuburbCombobox
              value={formData.dropoff || ""}
              onChange={(value) => setFormData((prev: Partial<WorkLog>) => ({ ...prev, dropoff: value }))}
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
