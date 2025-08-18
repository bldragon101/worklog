"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { IconLogo, PageType } from "@/components/brand/icon-logo";

interface PageControlsProps {
  type: PageType;
  // Jobs specific props
  selectedYear?: number;
  selectedMonth?: number;
  weekEnding?: Date | string;
  years?: number[];
  months?: number[];
  weekEndings?: Date[];
  onYearChange?: (year: number) => void;
  onMonthChange?: (month: number) => void;
  onWeekEndingChange?: (weekEnding: Date | string) => void;
}

export function PageControls({
  type,
  // Jobs props
  selectedYear,
  selectedMonth,
  weekEnding,
  years = [],
  months = [],
  weekEndings = [],
  onYearChange,
  onMonthChange,
  onWeekEndingChange,
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
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex lg:flex-wrap items-center gap-3 lg:gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <label htmlFor="year" className="text-sm font-medium whitespace-nowrap">Year:</label>
              <Select value={selectedYear?.toString()} onValueChange={(value) => onYearChange?.(parseInt(value))}>
                <SelectTrigger className="w-full sm:w-[100px] bg-white dark:bg-neutral-900">
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

            <div className="flex items-center gap-2 min-w-0">
              <label htmlFor="month" className="text-sm font-medium whitespace-nowrap">Month:</label>
              <Select value={selectedMonth?.toString()} onValueChange={(value) => onMonthChange?.(parseInt(value))}>
                <SelectTrigger className="w-full sm:w-[120px] bg-white dark:bg-neutral-900">
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

            <div className="flex items-center gap-2 min-w-0 sm:col-span-3 lg:col-span-1">
              <label htmlFor="week" className="text-sm font-medium whitespace-nowrap">Week ending:</label>
              <Select 
                value={weekEnding === SHOW_MONTH ? SHOW_MONTH : format(weekEnding as Date, "yyyy-MM-dd")} 
                onValueChange={(value) => onWeekEndingChange?.(value === SHOW_MONTH ? SHOW_MONTH : parseISO(value))}
              >
                <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-neutral-900">
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

  if (type === "vehicles") {
    return (
      <div className="bg-gradient-to-br from-blue-50/30 to-indigo-100/30 dark:from-transparent dark:to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconLogo pageType="vehicles" size={32} />
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">Vehicles</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">
                Manage your fleet of vehicles
              </p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return null;
} 