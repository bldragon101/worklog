"use client";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO, compareAsc, getYear, getMonth, getDay } from "date-fns";
import { DataTable, WorkLog } from "@/components/DataTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WorkLogForm } from "@/components/WorkLogForm";
import { ProtectedLayout } from "@/components/protected-layout";
import { Logo } from "@/components/Logo";

export default function DashboardPage() {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<Partial<WorkLog> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingRowId, setLoadingRowId] = useState<number | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    const response = await fetch('/api/worklog');
    const data = await response.json();
    setLogs(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // --- REWORKED FILTER INITIALIZATION ---
  const getUpcomingSunday = () => {
      return endOfWeek(new Date(), { weekStartsOn: 1 }); // Monday is the start of the week
  };
  const upcomingSunday = getUpcomingSunday();

  const [selectedYear, setSelectedYear] = useState<number>(getYear(upcomingSunday));
  const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(upcomingSunday));
  const [weekEnding, setWeekEnding] = useState<Date | string>(upcomingSunday);
  // --- END REWORK ---

  // Get all unique years from logs, ensuring the selected year is an option
  const yearsSet = new Set<number>(logs.map(log => getYear(parseISO(log.date))));
  yearsSet.add(selectedYear);
  const years = Array.from(yearsSet).sort((a, b) => a - b);

  // Get months for selected year, ensuring selected month is an option
  const monthsSet = new Set<number>();
  logs.forEach(log => {
    const logYear = getYear(parseISO(log.date));
    if (logYear === selectedYear) {
      monthsSet.add(getMonth(parseISO(log.date)));
    }
  });
  monthsSet.add(selectedMonth);
  const months = Array.from(monthsSet).sort((a, b) => a - b);

  // Days of week filter state
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const [selectedDays, setSelectedDays] = useState<string[]>(["1","2","3","4","5","6","0"]); // All days selected by default
  const allDayValues: string[] = ["1","2","3","4","5","6","0"];

  // Custom handler for day toggles
  const handleDayToggle = (val: string[]) => {
    // If all days are selected and user clicks one, only that day should be selected
    if (selectedDays.length === 7 && val.length === 6) {
      const toggled = allDayValues.find((d: string) => !val.includes(d));
      setSelectedDays(toggled ? [toggled] : []);
    } else if (selectedDays.length === 1 && val.length === 2) {
      // If only one day is selected and user clicks another, only show the new day
      const newDay = val.find((d: string) => !selectedDays.includes(d));
      setSelectedDays(newDay ? [newDay] : []);
    } else {
      setSelectedDays(val);
    }
  };

  // Get week endings for selected year and month
  const weekEndingsSet = new Set<string>();
  logs.forEach(log => {
    const logDate = parseISO(log.date);
    if (getYear(logDate) === selectedYear && getMonth(logDate) === selectedMonth) {
      weekEndingsSet.add(format(endOfWeek(logDate, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    }
  });
  
  // Also include week endings that start in the previous month but end in the selected month
  logs.forEach(log => {
    const logDate = parseISO(log.date);
    const weekEnd = endOfWeek(logDate, { weekStartsOn: 1 });
    // const weekStart = startOfWeek(logDate, { weekStartsOn: 1 });
    
    // Include if the week ends in the selected month and year, even if it starts in previous month
    if (getYear(weekEnd) === selectedYear && getMonth(weekEnd) === selectedMonth) {
      weekEndingsSet.add(format(weekEnd, "yyyy-MM-dd"));
    }
  });
  
  // Add the current week ending if it's in the selected year and month
  if (getYear(weekEnding) === selectedYear && getMonth(weekEnding) === selectedMonth) {
      weekEndingsSet.add(format(weekEnding as Date, "yyyy-MM-dd"));
  }
  const weekEndings = Array.from(weekEndingsSet)
      .map(dateStr => parseISO(dateStr))
      .sort((a, b) => compareAsc(a, b));

  // Add a special value for 'Show whole month'
  const SHOW_MONTH = "__SHOW_MONTH__";

  // Filter logs for the selected year, month, week, and days of week
  const filteredLogs = useMemo(() =>
    logs.filter(log => {
      if (!log.date) return false;
      const logDate = parseISO(log.date);
      
      // If showing whole month, filter by year and month
      if (weekEnding === SHOW_MONTH) {
        if (getYear(logDate) !== selectedYear || getMonth(logDate) !== selectedMonth) return false;
      } else {
        // If showing specific week, prioritize week filtering over month filtering
        // This allows entries from previous month to show if they're within the selected week
        const weekStart = startOfWeek(weekEnding as Date, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(weekEnding as Date, { weekStartsOn: 1 });
        const isInSelectedWeek = isWithinInterval(logDate, { start: weekStart, end: weekEnd });
        
        if (!isInSelectedWeek) return false;
        
        // For week view, still filter by year but allow cross-month weeks
        if (getYear(logDate) !== selectedYear) return false;
      }
      
      // Filter by days of week
      if (selectedDays.length > 0 && !selectedDays.includes(getDay(logDate).toString())) return false;
      
      return true;
    })
  , [logs, selectedYear, selectedMonth, selectedDays, weekEnding]);

  const startEdit = useCallback((log: WorkLog) => {
    setEditingLog(log);
    setIsFormOpen(true);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingLog(null);
    setIsFormOpen(false);
  }, []);

  const deleteLog = useCallback(async (log: WorkLog) => {
    if (window.confirm("Are you sure you want to delete this log?")) {
      setLoadingRowId(log.id);
      try {
        const response = await fetch(`/api/worklog/${log.id}`, { method: 'DELETE' });
        if (response.ok) {
          setLogs(prev => prev.filter(l => l.id !== log.id));
        }
      } catch (error) {
        console.error('Error deleting log:', error);
      } finally {
        setLoadingRowId(null);
      }
    }
  }, []);

  const saveEdit = useCallback(async (logData: Partial<WorkLog>) => {
    setIsSubmitting(true);
    try {
      const isNew = !logData.id;
      const url = isNew ? '/api/worklog' : `/api/worklog/${logData.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
      });

      if (response.ok) {
        const savedLog = await response.json();
        setLogs((prev) =>
          isNew
            ? [savedLog, ...prev]
            : prev.map((log) => (log.id === savedLog.id ? savedLog : log))
        );
        cancelEdit();
      }
    } catch (error) {
      console.error('Error saving log:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [cancelEdit]);

  const addEntry = useCallback(() => {
    setEditingLog({});
    setIsFormOpen(true);
  }, []);

  return (
    <ProtectedLayout>
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Logo width={48} height={48} className="h-12 w-12" />
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">Jobs</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">View, filter, and manage your jobs.</p>
            </div>
          </div>
        </header>

        <div className="flex flex-col space-y-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="year" className="text-sm font-medium">Year:</label>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="w-[100px]">
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
              <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                <SelectTrigger className="w-[120px]">
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
                onValueChange={(value) => setWeekEnding(value === SHOW_MONTH ? SHOW_MONTH : parseISO(value))}
              >
                <SelectTrigger className="w-[180px]">
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

            <Button onClick={addEntry} className="ml-auto">
              Add Entry
            </Button>
          </div>

          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium">Days of week:</label>
            <div className="flex flex-wrap items-center gap-2 w-full overflow-x-auto">
              <button
                type="button"
                onClick={() => setSelectedDays(allDayValues)}
                className={`h-9 px-4 py-0 font-semibold rounded-md border border-gray-200 dark:border-neutral-800 shadow-sm transition-colors ${selectedDays.length === 7 ? 'bg-blue-600 text-white' : 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white'}`}
                aria-pressed={selectedDays.length === 7}
              >
                All
              </button>
              <ToggleGroup variant="outline" type="multiple" value={selectedDays} onValueChange={handleDayToggle} className="flex-wrap justify-start">
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
        <div className="flex-1 min-h-0">
          <DataTable
            data={filteredLogs}
            isLoading={isLoading}
            onEdit={startEdit}
            onDelete={deleteLog}
            loadingRowId={loadingRowId}
            onImportSuccess={fetchLogs}
            filters={{
              startDate: weekEnding instanceof Date ? weekEnding.toISOString().split('T')[0] : undefined,
              endDate: weekEnding instanceof Date ? weekEnding.toISOString().split('T')[0] : undefined,
            }}
          />
        </div>
        <WorkLogForm
          isOpen={isFormOpen}
          onClose={cancelEdit}
          onSave={saveEdit}
          log={editingLog}
          isLoading={isSubmitting}
        />
      </div>
    </ProtectedLayout>
  );
}
