"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { format, parseISO } from "date-fns";
import { IconLogo, PageType } from "@/components/brand/icon-logo";

interface PageControlsProps {
  type: PageType;
  // Jobs specific props
  selectedYear?: number;
  selectedMonth?: number;
  weekEnding?: Date | string;
  selectedDays?: string[];
  years?: number[];
  months?: number[];
  weekEndings?: Date[];
  dayNames?: string[];
  allDayValues?: string[];
  onYearChange?: (year: number) => void;
  onMonthChange?: (month: number) => void;
  onWeekEndingChange?: (weekEnding: Date | string) => void;
  onDaysChange?: (days: string[]) => void;
}

export function PageControls({
  type,
  // Jobs props
  selectedYear,
  selectedMonth,
  weekEnding,
  selectedDays,
  years = [],
  months = [],
  weekEndings = [],
  dayNames = [],
  allDayValues = [],
  onYearChange,
  onMonthChange,
  onWeekEndingChange,
  onDaysChange,
}: PageControlsProps) {
  const SHOW_MONTH = "__SHOW_MONTH__";

  if (type === "jobs") {
    return (
      <div className="bg-gradient-to-br from-blue-50/30 to-indigo-100/30 dark:from-transparent dark:to-transparent p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-3">
            <IconLogo pageType="jobs" size={32} />
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">Jobs</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">View, filter, and manage your jobs.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="year" className="text-sm font-medium">Year:</label>
              <Select value={selectedYear?.toString()} onValueChange={(value) => onYearChange?.(parseInt(value))}>
                <SelectTrigger className="w-[100px] bg-white dark:bg-neutral-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="month" className="text-sm font-medium">Month:</label>
              <Select value={selectedMonth?.toString()} onValueChange={(value) => onMonthChange?.(parseInt(value))}>
                <SelectTrigger className="w-[120px] bg-white dark:bg-neutral-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month} value={month.toString()}>
                      {format(new Date(2024, month), "MMMM")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="week" className="text-sm font-medium">Week ending:</label>
              <Select 
                value={weekEnding === SHOW_MONTH ? SHOW_MONTH : format(weekEnding as Date, "yyyy-MM-dd")} 
                onValueChange={(value) => onWeekEndingChange?.(value === SHOW_MONTH ? SHOW_MONTH : parseISO(value))}
              >
                <SelectTrigger className="w-[180px] bg-white dark:bg-neutral-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SHOW_MONTH}>Show whole month</SelectItem>
                  {weekEndings.map((weekEnd) => (
                    <SelectItem key={format(weekEnd, "yyyy-MM-dd")} value={format(weekEnd, "yyyy-MM-dd")}>
                      {format(weekEnd, "MMM dd")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


          </div>

          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium">Days of week:</label>
            <div className="flex flex-wrap items-center gap-2 w-full overflow-x-auto">
              <button
                type="button"
                onClick={() => onDaysChange?.(allDayValues)}
                className={`h-9 px-4 py-0 font-semibold rounded-md border border-gray-200 dark:border-neutral-800 shadow-sm transition-colors ${selectedDays?.length === 7 ? 'bg-blue-600 text-white' : 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white'}`}
                aria-pressed={selectedDays?.length === 7}
              >
                All
              </button>
              <ToggleGroup variant="outline" type="multiple" value={selectedDays} onValueChange={onDaysChange} className="flex-wrap justify-start">
                {dayNames.map((name, i) => {
                  const dayIdx = (i + 1) % 7;
                  return (
                    <ToggleGroupItem
                      key={dayIdx}
                      value={dayIdx.toString()}
                      aria-label={`Toggle ${name}`}
                      className="h-9 px-3 py-0 font-semibold"
                    >
                      {name.substring(0, 3)}
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "customers") {
    return (
      <div className="bg-gradient-to-br from-blue-50/30 to-indigo-100/30 dark:from-transparent dark:to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconLogo pageType="customers" size={32} />
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">Customers</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">
                Manage your customer database
              </p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  if (type === "drivers") {
    return (
      <div className="bg-gradient-to-br from-blue-50/30 to-indigo-100/30 dark:from-transparent dark:to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconLogo pageType="drivers" size={32} />
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">Drivers</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">
                Manage driver information and schedules
              </p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return null;
} 