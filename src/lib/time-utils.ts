/**
 * Time conversion utilities for job forms and data processing
 */

/**
 * Converts a time string and date to an ISO datetime string
 * @param timeStr - Time in HH:MM format (e.g., "14:30")
 * @param dateStr - Date in YYYY-MM-DD format (e.g., "2025-01-15")
 * @returns ISO datetime string or null if invalid
 */
export function convertTimeToISO(timeStr: string | null, dateStr: string): string | null {
  if (!timeStr || !dateStr || timeStr.trim() === '') {
    return null;
  }

  try {
    // Parse time components
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    // Validate time components
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    // Create date object from date string
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null;
    }

    // Set the time components
    date.setHours(hours, minutes, 0, 0);
    
    return date.toISOString();
  } catch (error) {
    console.warn('Time conversion error:', error);
    return null;
  }
}

/**
 * Extracts time from an ISO datetime string
 * @param isoString - ISO datetime string
 * @returns Time string in HH:MM format or empty string if invalid
 */
export function extractTimeFromISO(isoString: string | null): string {
  if (!isoString) {
    return '';
  }

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return '';
    }

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${hours}:${minutes}`;
  } catch (error) {
    console.warn('Time extraction error:', error);
    return '';
  }
}

/**
 * Calculates the difference between two time strings in hours
 * @param startTime - Start time in HH:MM format
 * @param finishTime - Finish time in HH:MM format
 * @param dateStr - Date for the calculation (handles day boundaries)
 * @returns Number of hours or null if invalid
 */
export function calculateHoursDifference(
  startTime: string | null, 
  finishTime: string | null, 
  dateStr: string
): number | null {
  if (!startTime || !finishTime || !dateStr) {
    return null;
  }

  const startISO = convertTimeToISO(startTime, dateStr);
  const finishISO = convertTimeToISO(finishTime, dateStr);
  
  if (!startISO || !finishISO) {
    return null;
  }

  const startDate = new Date(startISO);
  const finishDate = new Date(finishISO);
  
  // Handle overnight shifts (finish time is next day)
  if (finishDate < startDate) {
    finishDate.setDate(finishDate.getDate() + 1);
  }

  const diffMs = finishDate.getTime() - startDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  return Math.round(diffHours * 100) / 100; // Round to 2 decimal places
}

/**
 * Validates a time string format
 * @param timeStr - Time string to validate
 * @returns true if valid HH:MM format, false otherwise
 */
export function isValidTimeFormat(timeStr: string): boolean {
  if (!timeStr || typeof timeStr !== 'string') {
    return false;
  }

  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeStr);
}

/**
 * Converts datetime or time string to display format (HH:MM)
 * @param timeValue - ISO datetime string or HH:MM format time string
 * @returns HH:MM format time string or null if invalid
 */
export function convertToDisplayTime(timeValue: string | null | undefined): string | null {
  if (!timeValue || typeof timeValue !== 'string') {
    return null;
  }

  // Check if it's a full datetime string (contains T or is ISO format)
  if (timeValue.includes('T') || timeValue.match(/^\d{4}-\d{2}-\d{2}/)) {
    try {
      return new Date(timeValue).toLocaleTimeString('en-GB', {
        timeZone: 'Australia/Melbourne',
        hour12: false
      }).slice(0, 5);
    } catch (error) {
      console.error('Error converting datetime to display time:', error);
      return null;
    }
  }

  // If it's already in HH:MM format, return as is
  return timeValue;
}

/**
 * Converts HH:MM time format to ISO datetime string for a given date
 * @param timeString - Time in HH:MM format
 * @param dateString - Date in YYYY-MM-DD format
 * @returns ISO datetime string or null if conversion fails
 */
export function convertToISODateTime(timeString: string | null | undefined, dateString: string): string | null {
  if (!timeString || typeof timeString !== 'string') {
    return null;
  }

  // Validate time format
  if (!isValidTimeFormat(timeString)) {
    console.error('Invalid time format:', timeString);
    return null;
  }

  try {
    // Extract just the date part if dateString is already an ISO string
    let dateOnly = dateString;
    if (dateString.includes('T')) {
      dateOnly = dateString.split('T')[0];
    }
    
    const dateTimeString = `${dateOnly}T${timeString}:00`;
    const localDate = new Date(dateTimeString);
    
    if (!isNaN(localDate.getTime())) {
      return localDate.toISOString();
    } else {
      console.error('Invalid datetime:', dateTimeString);
      return null;
    }
  } catch (error) {
    console.error('Error converting time to ISO datetime:', error);
    return null;
  }
}

/**
 * Processes job time fields for form submission
 * @param jobData - Job data with potential time fields
 * @param dateString - Date in YYYY-MM-DD format to use for time conversion
 * @returns Processed job data with ISO datetime strings for time fields
 */
export function processJobTimesForSubmission<T extends { startTime?: string | null; finishTime?: string | null }>(
  jobData: T, 
  dateString: string
): T {
  const processed = { ...jobData };

  if (processed.startTime) {
    processed.startTime = convertToISODateTime(processed.startTime, dateString);
  }

  if (processed.finishTime) {
    processed.finishTime = convertToISODateTime(processed.finishTime, dateString);
  }

  return processed;
}

/**
 * Processes job time fields for form display
 * @param jobData - Job data with potential ISO datetime fields
 * @returns Processed job data with HH:MM format time strings for display
 */
export function processJobTimesForDisplay<T extends { startTime?: string | null; finishTime?: string | null }>(
  jobData: T
): T {
  const processed = { ...jobData };

  processed.startTime = convertToDisplayTime(processed.startTime);
  processed.finishTime = convertToDisplayTime(processed.finishTime);

  return processed;
}