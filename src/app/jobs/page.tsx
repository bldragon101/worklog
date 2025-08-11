"use client";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO, compareAsc, getYear, getMonth } from "date-fns";
import { UnifiedDataTable } from "@/components/data-table/core/unified-data-table";
import { Job } from "@/lib/types";
import { JobForm } from "@/components/entities/job/job-form";
import { jobColumns } from "@/components/entities/job/job-columns";
import { jobSheetFields } from "@/components/entities/job/job-sheet-fields";
import { JobDataTableToolbar } from "@/components/entities/job/job-data-table-toolbar";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { PageControls } from "@/components/layout/page-controls";

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Partial<Job> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingRowId, setLoadingRowId] = useState<number | null>(null);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/jobs');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Ensure data is an array
      setJobs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]); // Set empty array on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // --- REWORKED FILTER INITIALIZATION ---
  const getUpcomingSunday = () => {
      return endOfWeek(new Date(), { weekStartsOn: 1 }); // Monday is the start of the week
  };
  const upcomingSunday = getUpcomingSunday();

  // Add a special value for 'Show whole month'
  const SHOW_MONTH = "__SHOW_MONTH__";

  const [selectedYear, setSelectedYear] = useState<number>(getYear(upcomingSunday));
  const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(upcomingSunday));
  const [weekEnding, setWeekEnding] = useState<Date | string>(upcomingSunday);
  // --- END REWORK ---

  // Get all unique years from jobs, ensuring the selected year is an option
  const yearsSet = new Set<number>(jobs.map(job => getYear(parseISO(job.date))));
  yearsSet.add(selectedYear);
  const years = Array.from(yearsSet).sort((a, b) => a - b);

  // Get months for selected year, ensuring selected month is an option
  const monthsSet = new Set<number>();
  jobs.forEach(job => {
    const jobYear = getYear(parseISO(job.date));
    if (jobYear === selectedYear) {
      monthsSet.add(getMonth(parseISO(job.date)));
    }
  });
  monthsSet.add(selectedMonth);
  const months = Array.from(monthsSet).sort((a, b) => a - b);


  // Get week endings for selected year and month
  const weekEndingsSet = new Set<string>();
  jobs.forEach(job => {
    const jobDate = parseISO(job.date);
    if (getYear(jobDate) === selectedYear && getMonth(jobDate) === selectedMonth) {
      weekEndingsSet.add(format(endOfWeek(jobDate, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    }
  });
  
  // Also include week endings that start in the previous month but end in the selected month
  jobs.forEach(job => {
    const jobDate = parseISO(job.date);
    const weekEnd = endOfWeek(jobDate, { weekStartsOn: 1 });
    // const weekStart = startOfWeek(jobDate, { weekStartsOn: 1 });
    
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

  // Filter logs for the selected year, month, and week (no days filtering)
  const filteredJobs = useMemo(() => {
    console.log('Filtering logs:', {
      totalJobs: jobs.length,
      selectedYear,
      selectedMonth,
      weekEnding,
      isShowMonth: weekEnding === SHOW_MONTH
    });
    
    // If jobs haven't loaded yet, return empty array to show loading state
    if (jobs.length === 0) {
      return [];
    }
    
    const filtered = jobs.filter(job => {
      if (!job.date) return false;
      const jobDate = parseISO(job.date);
      
      // If showing whole month, filter by year and month
      if (weekEnding === SHOW_MONTH) {
        const yearMatch = getYear(jobDate) === selectedYear;
        const monthMatch = getMonth(jobDate) === selectedMonth;
        
        if (!yearMatch || !monthMatch) {
          return false;
        }
      } else {
        // If showing specific week, prioritize week filtering over month filtering
        // This allows entries from previous month to show if they're within the selected week
        const weekStart = startOfWeek(weekEnding as Date, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(weekEnding as Date, { weekStartsOn: 1 });
        const isInSelectedWeek = isWithinInterval(jobDate, { start: weekStart, end: weekEnd });
        
        if (!isInSelectedWeek) {
          return false;
        }
        
        // For week view, still filter by year but allow cross-month weeks
        if (getYear(jobDate) !== selectedYear) {
          return false;
        }
      }
      
      return true;
    });
    
    console.log('Filtered jobs count:', filtered.length);
    return filtered;
  }, [jobs, selectedYear, selectedMonth, weekEnding]);

  const startEdit = useCallback((job: Job) => {
    setEditingJob(job);
    setIsFormOpen(true);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingJob(null);
    setIsFormOpen(false);
  }, []);

  const deleteJob = useCallback(async (job: Job) => {
    if (window.confirm("Are you sure you want to delete this job?")) {
      setLoadingRowId(job.id);
      try {
        const response = await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' });
        if (response.ok) {
          setJobs(prev => prev.filter(j => j.id !== job.id));
        }
      } catch (error) {
        console.error('Error deleting job:', error);
      } finally {
        setLoadingRowId(null);
      }
    }
  }, []);

  const saveEdit = useCallback(async (jobData: Partial<Job>) => {
    setIsSubmitting(true);
    try {
      const isNew = !jobData.id;
      const url = isNew ? '/api/jobs' : `/api/jobs/${jobData.id}`;
      const method = isNew ? 'POST' : 'PUT';

      console.log('Sending job data:', jobData);

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData),
      });

      if (response.ok) {
        const savedJob = await response.json();
        setJobs((prev) =>
          isNew
            ? [savedJob, ...prev]
            : prev.map((job) => (job.id === savedJob.id ? savedJob : job))
        );
        cancelEdit();
      } else {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        alert(`Error saving job: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error saving job:', error);
      alert('Error saving job. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [cancelEdit]);

  const addEntry = useCallback(() => {
    setEditingJob({});
    setIsFormOpen(true);
  }, []);

  const updateStatus = useCallback(async (id: number, field: 'runsheet' | 'invoiced', value: boolean) => {
    try {
      const response = await fetch(`/api/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });

      if (response.ok) {
        const updatedJob = await response.json();
        setJobs((prev) =>
          prev.map((job) => (job.id === updatedJob.id ? updatedJob : job))
        );
      } else {
        console.error('Failed to update status');
        alert('Failed to update status. Please try again.');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status. Please try again.');
    }
  }, []);

  return (
    <ProtectedLayout>
      <div className="flex flex-col h-full w-full max-w-full">

        <PageControls
          type="jobs"
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          weekEnding={weekEnding}
          years={years}
          months={months}
          weekEndings={weekEndings}
          onYearChange={setSelectedYear}
          onMonthChange={setSelectedMonth}
          onWeekEndingChange={setWeekEnding}
        />
        <div className="flex-1 min-h-0 w-full max-w-full">
          <UnifiedDataTable
            data={filteredJobs}
            columns={jobColumns(startEdit, deleteJob, isLoading, loadingRowId, updateStatus)}
            sheetFields={jobSheetFields}
            isLoading={isLoading}
            loadingRowId={loadingRowId}
            onEdit={startEdit}
            onDelete={deleteJob}
            onAdd={addEntry}
            onImportSuccess={fetchJobs}
            ToolbarComponent={JobDataTableToolbar}
            filters={{
              startDate: weekEnding instanceof Date ? weekEnding.toISOString().split('T')[0] : undefined,
              endDate: weekEnding instanceof Date ? weekEnding.toISOString().split('T')[0] : undefined,
            }}
          />
        </div>
        <JobForm
          isOpen={isFormOpen}
          onClose={cancelEdit}
          onSave={saveEdit}
          job={editingJob}
          isLoading={isSubmitting}
        />
      </div>
    </ProtectedLayout>
  );
}
