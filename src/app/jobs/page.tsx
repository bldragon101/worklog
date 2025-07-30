"use client";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO, compareAsc, getYear, getMonth, getDay } from "date-fns";
import { EnhancedDataTable, WorkLog } from "@/components/EnhancedDataTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WorkLogForm } from "@/components/WorkLogForm";
import { ProtectedLayout } from "@/components/protected-layout";
import { Logo } from "@/components/Logo";
import { PageControls } from "@/components/page-controls";

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
  const filteredLogs = useMemo(() => {
    console.log('Filtering logs:', {
      totalLogs: logs.length,
      selectedYear,
      selectedMonth,
      weekEnding,
      selectedDays,
      isShowMonth: weekEnding === SHOW_MONTH
    });
    
    const filtered = logs.filter(log => {
      if (!log.date) return false;
      const logDate = parseISO(log.date);
      
      // If showing whole month, filter by year and month
      if (weekEnding === SHOW_MONTH) {
        const yearMatch = getYear(logDate) === selectedYear;
        const monthMatch = getMonth(logDate) === selectedMonth;
        
        if (!yearMatch || !monthMatch) {
          return false;
        }
      } else {
        // If showing specific week, prioritize week filtering over month filtering
        // This allows entries from previous month to show if they're within the selected week
        const weekStart = startOfWeek(weekEnding as Date, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(weekEnding as Date, { weekStartsOn: 1 });
        const isInSelectedWeek = isWithinInterval(logDate, { start: weekStart, end: weekEnd });
        
        if (!isInSelectedWeek) {
          return false;
        }
        
        // For week view, still filter by year but allow cross-month weeks
        if (getYear(logDate) !== selectedYear) {
          return false;
        }
      }
      
      // Filter by days of week
      if (selectedDays.length > 0 && !selectedDays.includes(getDay(logDate).toString())) {
        return false;
      }
      
      return true;
    });
    
    console.log('Filtered logs count:', filtered.length);
    return filtered;
  }, [logs, selectedYear, selectedMonth, selectedDays, weekEnding]);

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

      console.log('Sending worklog data:', logData);

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
      } else {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        alert(`Error saving worklog: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error saving log:', error);
      alert('Error saving worklog. Please try again.');
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

        <PageControls
          type="jobs"
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          weekEnding={weekEnding}
          selectedDays={selectedDays}
          years={years}
          months={months}
          weekEndings={weekEndings}
          dayNames={dayNames}
          allDayValues={allDayValues}
          onYearChange={setSelectedYear}
          onMonthChange={setSelectedMonth}
          onWeekEndingChange={setWeekEnding}
          onDaysChange={handleDayToggle}
        />
        <div className="flex-1 min-h-0">
          <EnhancedDataTable
            data={filteredLogs}
            isLoading={isLoading}
            onEdit={startEdit}
            onDelete={deleteLog}
            loadingRowId={loadingRowId}
            onImportSuccess={fetchLogs}
            onAddEntry={addEntry}
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
