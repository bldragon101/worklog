"use client";
import React, { useState } from "react";
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

const initialLogs: WorkLog[] = [
  {
    id: 1,
    date: "2024-06-01",
    driver: "John Doe",
    customer: "Acme Corp",
    client: "Jane Smith",
    startTime: "08:00",
    finishTime: "12:00",
    truckType: "Semi",
    vehicle: "Truck 1",
    comments: "Delivered on time."
  },
  {
    id: 2,
    date: "2024-06-02",
    driver: "Alice Brown",
    customer: "Beta LLC",
    client: "Bob Lee",
    startTime: "09:30",
    finishTime: "14:00",
    truckType: "Crane",
    vehicle: "Truck 2",
    comments: "Heavy load."
  },
  // --- Dummy July 2025 logs ---
  {
    id: 3,
    date: "2025-07-01",
    driver: "Sam Carter",
    customer: "Delta Inc",
    client: "Chris Green",
    startTime: "07:00",
    finishTime: "11:00",
    truckType: "Tray",
    vehicle: "Truck 3",
    comments: "Smooth job."
  },
  {
    id: 4,
    date: "2025-07-03",
    driver: "Mia Lee",
    customer: "Omega LLC",
    client: "Pat Kim",
    startTime: "10:00",
    finishTime: "15:00",
    truckType: "Semi",
    vehicle: "Truck 4",
    comments: "Customer requested early delivery."
  },
  {
    id: 5,
    date: "2025-07-06",
    driver: "John Doe",
    customer: "Acme Corp",
    client: "Jane Smith",
    startTime: "08:30",
    finishTime: "13:00",
    truckType: "Crane",
    vehicle: "Truck 1",
    comments: "Weekend job."
  },
  {
    id: 6,
    date: "2025-07-08",
    driver: "Alice Brown",
    customer: "Beta LLC",
    client: "Bob Lee",
    startTime: "09:00",
    finishTime: "12:30",
    truckType: "Tray",
    vehicle: "Truck 2",
    comments: "Routine delivery."
  },
  {
    id: 7,
    date: "2025-07-12",
    driver: "Sam Carter",
    customer: "Delta Inc",
    client: "Chris Green",
    startTime: "11:00",
    finishTime: "16:00",
    truckType: "Semi",
    vehicle: "Truck 3",
    comments: "Heavy traffic."
  },
  {
    id: 8,
    date: "2025-07-13",
    driver: "Mia Lee",
    customer: "Omega LLC",
    client: "Pat Kim",
    startTime: "07:30",
    finishTime: "12:00",
    truckType: "Crane",
    vehicle: "Truck 4",
    comments: "Quick turnaround."
  },
  {
    id: 9,
    date: "2025-07-15",
    driver: "John Doe",
    customer: "Acme Corp",
    client: "Jane Smith",
    startTime: "08:00",
    finishTime: "11:30",
    truckType: "Tray",
    vehicle: "Truck 1",
    comments: "No issues."
  },
  {
    id: 10,
    date: "2025-07-19",
    driver: "Alice Brown",
    customer: "Beta LLC",
    client: "Bob Lee",
    startTime: "10:00",
    finishTime: "14:00",
    truckType: "Semi",
    vehicle: "Truck 2",
    comments: "Late start."
  },
  {
    id: 11,
    date: "2025-07-20",
    driver: "Sam Carter",
    customer: "Delta Inc",
    client: "Chris Green",
    startTime: "09:00",
    finishTime: "13:00",
    truckType: "Crane",
    vehicle: "Truck 3",
    comments: "Customer not present."
  },
  {
    id: 12,
    date: "2025-07-25",
    driver: "Mia Lee",
    customer: "Omega LLC",
    client: "Pat Kim",
    startTime: "12:00",
    finishTime: "17:00",
    truckType: "Tray",
    vehicle: "Truck 4",
    comments: "End of month rush."
  },
  // --- Dummy August 2025 logs ---
  {
    id: 13,
    date: "2025-08-03",
    driver: "Sam Carter",
    customer: "Delta Inc",
    client: "Chris Green",
    startTime: "08:00",
    finishTime: "12:00",
    truckType: "Semi",
    vehicle: "Truck 3",
    comments: "August job."
  },
  {
    id: 14,
    date: "2025-08-10",
    driver: "Mia Lee",
    customer: "Omega LLC",
    client: "Pat Kim",
    startTime: "09:00",
    finishTime: "13:00",
    truckType: "Crane",
    vehicle: "Truck 4",
    comments: "Another August job."
  },
  // --- Dummy July 2024 logs ---
  {
    id: 15,
    date: "2024-07-07",
    driver: "John Doe",
    customer: "Acme Corp",
    client: "Jane Smith",
    startTime: "08:00",
    finishTime: "12:00",
    truckType: "Semi",
    vehicle: "Truck 1",
    comments: "July 2024 job."
  },
  {
    id: 16,
    date: "2024-07-14",
    driver: "Alice Brown",
    customer: "Beta LLC",
    client: "Bob Lee",
    startTime: "09:30",
    finishTime: "14:00",
    truckType: "Crane",
    vehicle: "Truck 2",
    comments: "Another July 2024 job."
  }
];

export default function WorkLogPage() {
  const [logs, setLogs] = useState<WorkLog[]>(initialLogs);
  const [editId, setEditId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Partial<WorkLog>>({});
  const [calendarOpen, setCalendarOpen] = useState(false);

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
  const filteredLogs = logs.filter(log => {
    if (!log.date) return false;
    const logDate = parseISO(log.date);
    if (getYear(logDate) !== selectedYear || getMonth(logDate) !== selectedMonth) return false;
    if (selectedDays.length > 0 && !selectedDays.includes(getDay(logDate).toString())) return false;
    if (weekEnding === SHOW_MONTH) return true;
    const weekStart = startOfWeek(weekEnding as Date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekEnding as Date, { weekStartsOn: 1 });
    return isWithinInterval(logDate, { start: weekStart, end: weekEnd });
  });

  const startEdit = (log: WorkLog) => {
    setEditId(log.id);
    setEditRow({ ...log });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditRow({});
    setCalendarOpen(false);
  };

  const saveEdit = (row: WorkLog) => {
    setLogs((prev) => prev.map((log) => (log.id === editId ? row : log)));
    setEditId(null);
    setEditRow({});
    setCalendarOpen(false);
  };

  const addEntry = () => {
    const newId = logs.length > 0 ? Math.max(...logs.map(l => l.id)) + 1 : 1;
    const newEntry: WorkLog = {
      id: newId,
      date: format(new Date(), "yyyy-MM-dd"),
      driver: "",
      customer: "",
      client: "",
      startTime: "",
      finishTime: "",
      truckType: "",
      vehicle: "",
      comments: ""
    };
    setLogs([newEntry, ...logs]);
    setEditId(newId);
    setEditRow(newEntry);
    setCalendarOpen(false);
  };

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
          onSave={saveEdit}
          onCancel={cancelEdit}
          editId={editId}
          editRow={editRow}
          setEditRow={setEditRow}
          setCalendarOpen={setCalendarOpen}
          calendarOpen={calendarOpen}
        />
      </div>
    </div>
  );
}
