"use client";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format, addDays, startOfWeek, endOfWeek, isWithinInterval, parseISO, compareAsc, getYear, getMonth, getDay } from "date-fns";
import { Check, X, Pencil } from "lucide-react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { DataTable, WorkLog } from "@/components/DataTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WorkLogForm } from "@/components/WorkLogForm";

export default function WorkLogPage() {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<Partial<WorkLog> | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchLogs = async () => {
      const response = await fetch('/api/worklog');
      const data = await response.json();
      setLogs(data);
    };
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
      if (getYear(parseISO(log.date)) === selectedYear) {
          monthsSet.add(getMonth(parseISO(log.date)));
      }
  });
  if (getYear(new Date()) === selectedYear) {
      monthsSet.add(selectedMonth);
  }
  const months = Array.from(monthsSet).sort((a, b) => a - b);
  const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
  ];

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

  // Get week-ending Sundays for selected year and month, ensuring current is an option
  const weekEndingsSet = new Set<string>();
  logs.forEach(log => {
      if (log.date) {
          const logDate = parseISO(log.date);
          if (getYear(logDate) === selectedYear && getMonth(logDate) === selectedMonth) {
              const weekEnd = endOfWeek(logDate, { weekStartsOn: 1 });
              weekEndingsSet.add(format(weekEnd, "yyyy-MM-dd"));
          }
      }
  });
  if (typeof weekEnding !== 'string' && getYear(weekEnding) === selectedYear && getMonth(weekEnding) === selectedMonth) {
      weekEndingsSet.add(format(weekEnding, "yyyy-MM-dd"));
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
      if (getYear(logDate) !== selectedYear || getMonth(logDate) !== selectedMonth) return false;
      if (selectedDays.length > 0 && !selectedDays.includes(getDay(logDate).toString())) return false;
      if (weekEnding === SHOW_MONTH) return true;
      const weekStart = startOfWeek(weekEnding as Date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekEnding as Date, { weekStartsOn: 1 });
      return isWithinInterval(logDate, { start: weekStart, end: weekEnd });
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
      const response = await fetch(`/api/worklog/${log.id}`, { method: 'DELETE' });
      if (response.ok) {
        setLogs(prev => prev.filter(l => l.id !== log.id));
      }
    }
  }, []);

  const saveEdit = useCallback(async (logData: Partial<WorkLog>) => {
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
    }
    cancelEdit();
  }, [cancelEdit]);

  const addEntry = useCallback(() => {
    setEditingLog({});
    setIsFormOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col items-center py-8 px-2">
      <header className="w-full max-w-6xl mx-auto mb-8">
        <h1 className="text-4xl font-extrabold text-center text-gray-900 dark:text-white tracking-tight mb-2">Work Log</h1>
        <p className="text-center text-gray-500 dark:text-gray-400 text-base">View, filter, and manage your job logs by week, month, and day.</p>
      </header>
      <div className="w-full max-w-6xl sticky top-0 z-20">
        <div className="bg-white/90 dark:bg-black/80 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-md px-4 py-4 mb-8 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full">
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <Select
                value={selectedYear.toString()}
                onValueChange={val => {
                  setSelectedYear(Number(val));
                  setSelectedMonth(0); // Reset month to January or first available
                }}
              >
                <SelectTrigger className="w-full sm:w-[120px] bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-neutral-700">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedMonth.toString()}
                onValueChange={val => setSelectedMonth(Number(val))}
              >
                <SelectTrigger className="w-full sm:w-[140px] bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-neutral-700">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m.toString()}>{monthNames[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={typeof weekEnding === "string" ? weekEnding : format(weekEnding, "yyyy-MM-dd")}
                onValueChange={val => {
                  if (val === SHOW_MONTH) {
                    setWeekEnding(SHOW_MONTH);
                  } else {
                    const d = parseISO(val);
                    setWeekEnding(d);
                  }
                }}
              >
                <SelectTrigger className="w-full sm:w-[200px] bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-neutral-700">
                  <SelectValue placeholder="Pick week ending" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key={SHOW_MONTH} value={SHOW_MONTH}>
                    Show whole month
                  </SelectItem>
                  {weekEndings.map((d) => (
                    <SelectItem key={format(d, "yyyy-MM-dd")}
                      value={format(d, "yyyy-MM-dd")}
                    >
                      Week ending: {format(d, "dd/MM/yy")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button onClick={addEntry} variant="default" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg shadow w-full sm:w-auto">
                + Add Entry
              </Button>
            </div>
          </div>
          <div className="flex justify-start w-full">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedDays(allDayValues)}
                className={`h-9 px-4 py-0 font-semibold rounded-md border border-gray-200 dark:border-neutral-800 shadow-sm transition-colors ${selectedDays.length === 7 ? 'bg-blue-600 text-white' : 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white'}`}
                aria-pressed={selectedDays.length === 7}
              >
                All Days
              </button>
              <ToggleGroup variant="outline" type="multiple" value={selectedDays} onValueChange={handleDayToggle} className="inline-flex rounded-md shadow-sm border border-gray-200 dark:border-neutral-800 overflow-hidden">
                {dayNames.map((name, i) => {
                  // Map Monday=1, ..., Sunday=0 for getDay
                  const dayIdx = (i + 1) % 7;
                  return (
                    <ToggleGroupItem
                      key={dayIdx}
                      value={dayIdx.toString()}
                      aria-label={`Toggle ${name}`}
                      className="h-9 px-4 py-0 font-semibold rounded-none border-0"
                    >
                      {name}
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            </div>
          </div>
        </div>
      </div>
      <div className="w-full mb-8">
        <DataTable
          data={filteredLogs}
          onEdit={startEdit}
          onDelete={deleteLog}
        />
      </div>
      <WorkLogForm
        isOpen={isFormOpen}
        onClose={cancelEdit}
        onSave={saveEdit}
        log={editingLog}
      />
    </div>
  );
}
