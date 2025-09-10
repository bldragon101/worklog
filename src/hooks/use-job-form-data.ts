import * as React from 'react';
import { Job } from '@/lib/types';
import { processJobTimesForDisplay } from '@/lib/time-utils';

/**
 * Custom hook for managing job form data and unsaved changes tracking
 * @param job - The job being edited (null for new job)
 * @returns Form data state and handlers
 */
export function useJobFormData(job: Partial<Job> | null) {
  // Initialize form data with proper defaults
  const getInitialFormData = React.useCallback(() => {
    if (job && job.id) {
      // Editing existing job - use job data
      return { ...job };
    } else if (job && Object.keys(job).length > 0) {
      // Duplicating a job or creating with preset data - use provided data
      return { ...job };
    } else {
      // Creating new job - set default date to today
      return { date: new Date().toISOString().split('T')[0] };
    }
  }, [job]);
  
  const [formData, setFormData] = React.useState<Partial<Job>>(getInitialFormData);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  React.useEffect(() => {
    // Reset form data when job prop changes
    const initialData = getInitialFormData();
    
    if (job && job.id) {
      // Editing existing job - process time fields for display
      const processedJobWithTimes = processJobTimesForDisplay(initialData);
      setFormData(processedJobWithTimes);
    } else if (job && Object.keys(job).length > 0 && (job.startTime || job.finishTime)) {
      // Duplicating with time fields - process time fields for display
      const processedJobWithTimes = processJobTimesForDisplay(initialData);
      setFormData(processedJobWithTimes);
    } else {
      // Creating new job or duplicating without times - use initial data
      setFormData(initialData);
    }
    
    // Reset unsaved changes when job changes
    setHasUnsavedChanges(false);
  }, [job, getInitialFormData]);
  
  // Track changes to form data to detect unsaved changes
  React.useEffect(() => {
    if (!job || !job.id) {
      // For new jobs, check if any meaningful data has been entered
      const hasData = formData.driver || formData.customer || formData.billTo || 
                     formData.registration || formData.truckType || formData.pickup || 
                     formData.dropoff || formData.comments || formData.startTime || 
                     formData.finishTime || formData.chargedHours || formData.driverCharge ||
                     formData.jobReference || formData.eastlink || formData.citylink;
      setHasUnsavedChanges(!!hasData);
    } else {
      // For existing jobs, compare current data with original job data
      const initialData = getInitialFormData();
      // Process initial data for fair comparison (convert times to display format)
      const processedInitialData = processJobTimesForDisplay(initialData);
      const hasChanges = JSON.stringify(formData) !== JSON.stringify(processedInitialData);
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, job, getInitialFormData]);

  return {
    formData,
    setFormData,
    hasUnsavedChanges,
    setHasUnsavedChanges
  };
}