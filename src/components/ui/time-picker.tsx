"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock } from "lucide-react"

interface TimePickerProps {
  value?: string // HH:mm format
  onChange?: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  id?: string
}

export function TimePicker({ 
  value, 
  onChange, 
  disabled = false, 
  placeholder = "Select time", 
  className,
  id 
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [hours, setHours] = React.useState("")
  const [minutes, setMinutes] = React.useState("")

  // Parse initial value
  React.useEffect(() => {
    if (value) {
      let timeString = value;
      
      // If value is a full datetime string, extract just the time part
      if (value.includes('T') || value.match(/^\d{4}-\d{2}-\d{2}/)) {
        try {
          timeString = new Date(value).toLocaleTimeString('en-GB', {timeZone: 'Australia/Melbourne', hour12: false}).slice(0, 5);
        } catch (error) {
          console.error('Error parsing datetime in TimePicker:', error);
          timeString = "";
        }
      }
      
      if (timeString && timeString.includes(":")) {
        const [h, m] = timeString.split(":")
        setHours(h || "")
        setMinutes(m || "")
      } else {
        setHours("")
        setMinutes("")
      }
    } else {
      setHours("")
      setMinutes("")
    }
  }, [value])

  // Generate options
  const hourOptions = Array.from({ length: 24 }, (_, i) => 
    i.toString().padStart(2, "0")
  )
  
  // Only 15-minute intervals: 00, 15, 30, 45
  const minuteOptions = ["00", "15", "30", "45"]

  const handleHourChange = (hour: string) => {
    const currentMinutes = minutes || "00"
    setHours(hour)
    setMinutes(currentMinutes)
  }

  const handleMinuteChange = (minute: string) => {
    const currentHours = hours || "08"
    setHours(currentHours)
    setMinutes(minute)
  }

  const handleOkClick = () => {
    const currentHours = hours || "08"
    const currentMinutes = minutes || "00"
    const formattedTime = `${currentHours.padStart(2, '0')}:${currentMinutes}`
    // Only log in development or when not in test environment
    if (process.env.NODE_ENV !== 'test') {
      console.log('TimePicker: OK clicked, time set to', formattedTime)
    }
    onChange?.(formattedTime)
    setOpen(false)
  }


  // Create display text from current state
  const getDisplayTime = () => {
    if (value) {
      return value;
    }
    if (hours && minutes) {
      return `${hours}:${minutes}`;
    }
    if (hours) {
      return `${hours}:00`;
    }
    if (minutes) {
      return `08:${minutes}`;
    }
    return "";
  };

  const displayTime = getDisplayTime();
  const displayText = displayTime || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !displayTime && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <Clock className="mr-2 h-4 w-4" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col space-y-2 p-4">
          <div className="flex space-x-2">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Hours</label>
              <Select value={hours} onValueChange={handleHourChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="HH" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {hourOptions.map((hour) => (
                    <SelectItem key={hour} value={hour}>
                      {hour}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Minutes</label>
              <Select value={minutes} onValueChange={handleMinuteChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="MM" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {minuteOptions.map((minute) => (
                    <SelectItem key={minute} value={minute}>
                      {minute}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Get current time in Melbourne timezone
                const now = new Date()
                const melbourneTime = new Date(now.toLocaleString("en-US", {timeZone: "Australia/Melbourne"}))
                const h = melbourneTime.getHours().toString().padStart(2, "0")
                const currentMinutes = melbourneTime.getMinutes()
                
                // Round to nearest 15-minute interval
                const roundedMinutes = Math.round(currentMinutes / 15) * 15
                const m = roundedMinutes.toString().padStart(2, "0")
                
                setHours(h)
                setMinutes(m)
              }}
            >
              Now (Melbourne)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setHours("")
                setMinutes("")
                onChange?.("")
                setOpen(false)
              }}
            >
              Clear
            </Button>
          </div>
          <div className="flex justify-end mt-2">
            <Button
              size="sm"
              onClick={handleOkClick}
              disabled={!hours && !minutes}
            >
              OK
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}