import * as React from 'react';
import { Job } from '@/lib/types';
import { processJobTimesForSubmission } from '@/lib/time-utils';

/**
 * Custom hook for job form validation and submission handling
 * @returns Validation state and submission handler
 */
export function useJobFormValidation() {
  const [showValidationDialog, setShowValidationDialog] = React.useState(false);
  const [missingFields, setMissingFields] = React.useState<string[]>([]);
  const [showCloseConfirmation, setShowCloseConfirmation] = React.useState(false);

  /**
   * Validates job form data and handles submission
   * @param formData - Form data to validate and submit
   * @param onSave - Save callback function
   * @param setHasUnsavedChanges - Function to clear unsaved changes flag
   * @returns Whether submission was successful
   */
  const handleSubmit = React.useCallback((
    formData: Partial<Job>,
    onSave: (job: Partial<Job>) => void,
    setHasUnsavedChanges: (value: boolean) => void
  ) => {
    const submitData = { ...formData };
    const missing: string[] = [];

    // Required field validation
    if (!submitData.date) missing.push('Date');
    if (!submitData.driver) missing.push('Driver');
    if (!submitData.customer) missing.push('Customer');
    if (!submitData.pickup) missing.push('Pick up');

    if (missing.length > 0) {
      setMissingFields(missing);
      setShowValidationDialog(true);
      return false;
    }

    // Convert pickup/dropoff arrays to strings if they are arrays
    if (Array.isArray(submitData.pickup)) {
      submitData.pickup = submitData.pickup.join(', ');
    }
    if (Array.isArray(submitData.dropoff)) {
      submitData.dropoff = submitData.dropoff.join(', ');
    }

    // Process time fields for submission
    const dateForSubmission = formData.date || new Date().toISOString().split('T')[0];
    const processedSubmitData = processJobTimesForSubmission(submitData, dateForSubmission);

    // Clear unsaved changes flag before saving
    setHasUnsavedChanges(false);
    onSave(processedSubmitData);
    return true;
  }, []);

  /**
   * Handles close attempts with unsaved changes confirmation
   * @param hasUnsavedChanges - Whether there are unsaved changes
   * @param onClose - Close callback function
   */
  const handleCloseAttempt = React.useCallback((
    hasUnsavedChanges: boolean,
    onClose: () => void
  ) => {
    if (hasUnsavedChanges) {
      setShowCloseConfirmation(true);
    } else {
      onClose();
    }
  }, []);

  /**
   * Confirms close and discards unsaved changes
   * @param onClose - Close callback function
   * @param setHasUnsavedChanges - Function to clear unsaved changes flag
   */
  const confirmClose = React.useCallback((
    onClose: () => void,
    setHasUnsavedChanges: (value: boolean) => void
  ) => {
    setHasUnsavedChanges(false);
    setShowCloseConfirmation(false);
    onClose();
  }, []);

  return {
    showValidationDialog,
    setShowValidationDialog,
    missingFields,
    showCloseConfirmation,
    setShowCloseConfirmation,
    handleSubmit,
    handleCloseAttempt,
    confirmClose
  };
}