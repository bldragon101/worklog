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
import { MultiSuburbCombobox } from "@/components/shared/multi-suburb-combobox";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { TimePicker } from "@/components/ui/time-picker";

type JobFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (job: Partial<Job>) => void;
  job: Partial<Job> | null;
  isLoading?: boolean;
};

// Helper functions to convert between arrays and comma-separated strings
const stringToArray = (str: string | undefined): string[] => {
  if (!str || str.trim() === '') return [];
  return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
};

const arrayToString = (arr: string[]): string => {
  return arr.filter(s => s.length > 0).join(', ');
};

export function JobForm({ isOpen, onClose, onSave, job, isLoading = false }: JobFormProps) {
  const [formData, setFormData] = React.useState<Partial<Job>>({});
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  
  // Dynamic select options state
  const [customerOptions, setCustomerOptions] = React.useState<string[]>([]);
  const [billToOptions, setBillToOptions] = React.useState<string[]>([]);
  const [registrationOptions, setRegistrationOptions] = React.useState<string[]>([]);
  const [truckTypeOptions, setTruckTypeOptions] = React.useState<string[]>([]);
  const [driverOptions, setDriverOptions] = React.useState<string[]>([]);
  const [selectsLoading, setSelectsLoading] = React.useState(true);
  
  // Auto-population mappings
  const [customerToBillTo, setCustomerToBillTo] = React.useState<Record<string, string>>({});
  const [registrationToType, setRegistrationToType] = React.useState<Record<string, string>>({});
  const [driverToTruck, setDriverToTruck] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (job) {
      const processedJob = { ...job };
      
      
      // Convert datetime strings to time strings for display
      if (processedJob.startTime && typeof processedJob.startTime === 'string') {
        // Check if it's a full datetime string (contains T or is ISO format)
        if (processedJob.startTime.includes('T') || processedJob.startTime.match(/^\d{4}-\d{2}-\d{2}/)) {
          processedJob.startTime = new Date(processedJob.startTime).toLocaleTimeString('en-GB', {timeZone: 'Australia/Melbourne', hour12: false}).slice(0, 5);
        }
        // If it's already in HH:MM format, leave it as is
      }
      
      if (processedJob.finishTime && typeof processedJob.finishTime === 'string') {
        // Check if it's a full datetime string (contains T or is ISO format)
        if (processedJob.finishTime.includes('T') || processedJob.finishTime.match(/^\d{4}-\d{2}-\d{2}/)) {
          processedJob.finishTime = new Date(processedJob.finishTime).toLocaleTimeString('en-GB', {timeZone: 'Australia/Melbourne', hour12: false}).slice(0, 5);
        }
        // If it's already in HH:MM format, leave it as is
      }
      
      setFormData(processedJob);
    } else {
      setFormData({});
    }
  }, [job]);

  // Fetch options for dynamic selects and mappings
  React.useEffect(() => {
    const fetchOptions = async () => {
      try {
        setSelectsLoading(true);
        const [customerResponse, vehicleResponse, driverResponse, customerMappingResponse, vehicleMappingResponse, driverMappingResponse] = await Promise.all([
          fetch('/api/customers/select-options'),
          fetch('/api/vehicles/select-options'),
          fetch('/api/drivers/select-options'),
          fetch('/api/customers/mappings'),
          fetch('/api/vehicles/mappings'),
          fetch('/api/drivers/mappings')
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

        if (driverResponse.ok) {
          const driverData = await driverResponse.json();
          setDriverOptions(driverData.driverOptions || []);
        }

        if (customerMappingResponse.ok) {
          const customerMappingData = await customerMappingResponse.json();
          setCustomerToBillTo(customerMappingData.customerToBillTo || {});
        }

        if (vehicleMappingResponse.ok) {
          const vehicleMappingData = await vehicleMappingResponse.json();
          setRegistrationToType(vehicleMappingData.registrationToType || {});
        }

        if (driverMappingResponse.ok) {
          const driverMappingData = await driverMappingResponse.json();
          setDriverToTruck(driverMappingData.driverToTruck || {});
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
        if (truckRegistration && registrationToType[truckRegistration] && !prev.truckType) {
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
      if (registrationValue && registrationToType[registrationValue] && !prev.truckType) {
        updatedData.truckType = registrationToType[registrationValue];
      }
      
      return updatedData;
    });
  };

  const handlePickupChange = (pickupArray: string[]) => {
    setFormData((prev: Partial<Job>) => ({ ...prev, pickup: arrayToString(pickupArray) }));
  };

  const handleDropoffChange = (dropoffArray: string[]) => {
    setFormData((prev: Partial<Job>) => ({ ...prev, dropoff: arrayToString(dropoffArray) }));
  };

  const handleTimeChange = (name: 'startTime' | 'finishTime', value: string) => {
    setFormData((prev: Partial<Job>) => {
      // Store the time string directly for now - we'll convert on save
      const updatedData = { ...prev, [name]: value };
      
      // Auto-calculate charged hours if both times are provided
      const startTimeValue = name === 'startTime' ? value : prev.startTime as string;
      const finishTimeValue = name === 'finishTime' ? value : prev.finishTime as string;
      
      if (startTimeValue && finishTimeValue) {
        const start = new Date(`1970-01-01T${startTimeValue.padStart(5, '0')}:00`);
        const finish = new Date(`1970-01-01T${finishTimeValue.padStart(5, '0')}:00`);
        
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
  };

  const handleSubmit = () => {
    if (!isLoading) {
      // Convert time strings to datetime format for API
      const submitData = { ...formData };
      
      
      // Ensure we have a valid date in YYYY-MM-DD format
      let dateForTimeConversion = formData.date || new Date().toISOString().split('T')[0];
      if (dateForTimeConversion && !dateForTimeConversion.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // If date is not in YYYY-MM-DD format, try to parse and convert it
        try {
          const parsedDate = new Date(dateForTimeConversion);
          if (!isNaN(parsedDate.getTime())) {
            dateForTimeConversion = parsedDate.toISOString().split('T')[0];
          }
        } catch {
          dateForTimeConversion = new Date().toISOString().split('T')[0]; // fallback to today
        }
      }
      
      if (submitData.startTime && typeof submitData.startTime === 'string' && submitData.startTime.includes(':')) {
        const dateTimeString = `${dateForTimeConversion}T${submitData.startTime}:00`;
        try {
          const localDate = new Date(dateTimeString);
          if (!isNaN(localDate.getTime())) {
            submitData.startTime = localDate.toISOString();
          } else {
            console.error('Invalid start time:', dateTimeString);
          }
        } catch (error) {
          console.error('Error converting start time:', error);
        }
      }
      
      if (submitData.finishTime && typeof submitData.finishTime === 'string' && submitData.finishTime.includes(':')) {
        const dateTimeString = `${dateForTimeConversion}T${submitData.finishTime}:00`;
        try {
          const localDate = new Date(dateTimeString);
          if (!isNaN(localDate.getTime())) {
            submitData.finishTime = localDate.toISOString();
          } else {
            console.error('Invalid finish time:', dateTimeString);
          }
        } catch (error) {
          console.error('Error converting finish time:', error);
        }
      }
      
      onSave(submitData);
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
            <label htmlFor="driver-select">Driver</label>
            <SearchableSelect
              id="driver-select"
              value={formData.driver || ""}
              onChange={handleDriverChange}
              options={driverOptions}
              placeholder="Select driver..."
              className="w-full"
              disabled={isLoading}
              loading={selectsLoading}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="customer-select">Customer</label>
            <SearchableSelect
              id="customer-select"
              value={formData.customer || ""}
              onChange={handleCustomerChange}
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
              onChange={handleRegistrationChange}
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
            <MultiSuburbCombobox
              id="pickup"
              values={stringToArray(formData.pickup)}
              onChange={handlePickupChange}
              placeholder="Search pickup suburbs..."
              className="w-full"
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="dropoff">Drop off</label>
            <MultiSuburbCombobox
              id="dropoff"
              values={stringToArray(formData.dropoff)}
              onChange={handleDropoffChange}
              placeholder="Search dropoff suburbs..."
              className="w-full"
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="start-time">Start Time</label>
            <TimePicker
              id="start-time"
              value={formData.startTime as string || ""}
              onChange={(value) => handleTimeChange('startTime', value)}
              disabled={isLoading}
              placeholder="Select start time"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="finish-time">Finish Time</label>
            <TimePicker
              id="finish-time"
              value={formData.finishTime as string || ""}
              onChange={(value) => handleTimeChange('finishTime', value)}
              disabled={isLoading}
              placeholder="Select finish time"
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
