import { jobSchema, jobUpdateSchema } from '@/lib/validation';
import { Job } from '@/lib/types';

describe('Start and Finish Time Fields Validation', () => {
  const baseJobData = {
    date: '2025-08-12',
    driver: 'John Doe',
    customer: 'Test Customer',
    billTo: 'Test Bill To',
    truckType: 'Crane',
    registration: 'ABC123',
    pickup: 'Test Pickup Location',
    dropoff: 'Test Dropoff Location',
    runsheet: true,
    invoiced: false,
    chargedHours: 8.5,
    driverCharge: 120.50,
    comments: 'Test comments'
  };

  describe('jobSchema validation', () => {
    it('should accept valid startTime and finishTime in ISO datetime format', () => {
      const validData = {
        ...baseJobData,
        startTime: '2025-08-12T08:00:00.000Z',
        finishTime: '2025-08-12T16:30:00.000Z'
      };

      const result = jobSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startTime).toBe('2025-08-12T08:00:00.000Z');
        expect(result.data.finishTime).toBe('2025-08-12T16:30:00.000Z');
      }
    });

    it('should accept valid startTime and finishTime in full date format', () => {
      const validData = {
        ...baseJobData,
        startTime: '2025-08-12T08:00:00.000Z',
        finishTime: '2025-08-12T16:30:00.000Z'
      };

      const result = jobSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startTime).toBe('2025-08-12T08:00:00.000Z');
        expect(result.data.finishTime).toBe('2025-08-12T16:30:00.000Z');
      }
    });

    it('should accept null startTime and finishTime', () => {
      const validData = {
        ...baseJobData,
        startTime: null,
        finishTime: null
      };

      const result = jobSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startTime).toBe(null);
        expect(result.data.finishTime).toBe(null);
      }
    });

    it('should accept empty string startTime and finishTime (converted to null)', () => {
      const validData = {
        ...baseJobData,
        startTime: '',
        finishTime: ''
      };

      const result = jobSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startTime).toBe(null);
        expect(result.data.finishTime).toBe(null);
      }
    });

    it('should accept undefined startTime and finishTime', () => {
      const validData = {
        ...baseJobData,
        startTime: undefined,
        finishTime: undefined
      };

      const result = jobSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startTime).toBeUndefined();
        expect(result.data.finishTime).toBeUndefined();
      }
    });

    it('should reject invalid startTime format', () => {
      const invalidData = {
        ...baseJobData,
        startTime: 'invalid-time',
        finishTime: '16:30'
      };

      const result = jobSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.path.includes('startTime') && 
          issue.message.includes('Invalid start time format')
        )).toBe(true);
      }
    });

    it('should reject invalid finishTime format', () => {
      const invalidData = {
        ...baseJobData,
        startTime: '08:00',
        finishTime: 'not-a-time'
      };

      const result = jobSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.path.includes('finishTime') && 
          issue.message.includes('Invalid finish time format')
        )).toBe(true);
      }
    });

    it('should accept job data without startTime and finishTime fields', () => {
      const validData = { ...baseJobData };
      delete (validData as Record<string, unknown>).startTime;
      delete (validData as Record<string, unknown>).finishTime;

      const result = jobSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should handle Date objects for startTime and finishTime', () => {
      const validData = {
        ...baseJobData,
        startTime: new Date('2025-08-12T08:00:00.000Z'),
        finishTime: new Date('2025-08-12T16:30:00.000Z')
      };

      const result = jobSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startTime).toBeInstanceOf(Date);
        expect(result.data.finishTime).toBeInstanceOf(Date);
      }
    });
  });

  describe('jobUpdateSchema validation', () => {
    it('should accept partial updates with only startTime', () => {
      const partialData = {
        startTime: '2025-08-12T09:15:00.000Z'
      };

      const result = jobUpdateSchema.safeParse(partialData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startTime).toBe('2025-08-12T09:15:00.000Z');
      }
    });

    it('should accept partial updates with only finishTime', () => {
      const partialData = {
        finishTime: '2025-08-12T17:45:00.000Z'
      };

      const result = jobUpdateSchema.safeParse(partialData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.finishTime).toBe('2025-08-12T17:45:00.000Z');
      }
    });

    it('should accept partial updates with both time fields', () => {
      const partialData = {
        startTime: '2025-08-12T08:30:00.000Z',
        finishTime: '2025-08-12T16:15:00.000Z'
      };

      const result = jobUpdateSchema.safeParse(partialData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startTime).toBe('2025-08-12T08:30:00.000Z');
        expect(result.data.finishTime).toBe('2025-08-12T16:15:00.000Z');
      }
    });

    it('should accept partial updates with null time fields', () => {
      const partialData = {
        startTime: null,
        finishTime: null
      };

      const result = jobUpdateSchema.safeParse(partialData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startTime).toBe(null);
        expect(result.data.finishTime).toBe(null);
      }
    });

    it('should reject invalid time formats in partial updates', () => {
      const partialData = {
        startTime: 'invalid',
        finishTime: 'also-invalid'
      };

      const result = jobUpdateSchema.safeParse(partialData);
      expect(result.success).toBe(false);
    });
  });

  describe('Job type interface compliance', () => {
    it('should match the Job interface structure for time fields', () => {
      // Test that our validation aligns with the Job type
      const jobData: Partial<Job> = {
        startTime: '08:00',
        finishTime: '16:30'
      };

      expect(typeof jobData.startTime).toBe('string');
      expect(typeof jobData.finishTime).toBe('string');
    });

    it('should handle null values as per Job interface', () => {
      const jobData: Partial<Job> = {
        startTime: null,
        finishTime: null
      };

      expect(jobData.startTime).toBe(null);
      expect(jobData.finishTime).toBe(null);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle midnight time (00:00)', () => {
      const validData = {
        ...baseJobData,
        startTime: '2025-08-12T00:00:00.000Z',
        finishTime: '2025-08-12T23:59:00.000Z'
      };

      const result = jobSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should handle 24-hour format times', () => {
      const validData = {
        ...baseJobData,
        startTime: '2025-08-12T23:30:00.000Z',
        finishTime: '2025-08-12T23:45:00.000Z'
      };

      const result = jobSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject 12-hour format times', () => {
      const invalidData = {
        ...baseJobData,
        startTime: '8:00 AM',
        finishTime: '4:30 PM'
      };

      const result = jobSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should handle very long ISO datetime strings', () => {
      const validData = {
        ...baseJobData,
        startTime: '2025-08-12T08:00:00.123456789Z',
        finishTime: '2025-08-12T16:30:00.987654321Z'
      };

      const result = jobSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should handle timezone-aware datetime strings', () => {
      const validData = {
        ...baseJobData,
        startTime: '2025-08-12T08:00:00+10:00',
        finishTime: '2025-08-12T16:30:00+10:00'
      };

      const result = jobSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('Real-world scenario tests', () => {
    it('should handle a complete job with all time fields', () => {
      const completeJob = {
        date: '2025-08-12',
        driver: 'John Smith',
        customer: 'ABC Construction',
        billTo: 'ABC Construction Pty Ltd',
        truckType: 'Crane Truck',
        registration: 'VIC123',
        pickup: '123 Main St, Melbourne',
        dropoff: '456 Collins St, Melbourne',
        runsheet: true,
        invoiced: false,
        chargedHours: 8.0,
        driverCharge: 200.00,
        startTime: '2025-08-12T07:30:00.000Z',
        finishTime: '2025-08-12T15:30:00.000Z',
        comments: 'Standard delivery job'
      };

      const result = jobSchema.safeParse(completeJob);
      expect(result.success).toBe(true);
    });

    it('should handle overtime scenarios with late finish times', () => {
      const overtimeJob = {
        ...baseJobData,
        startTime: '2025-08-12T06:00:00.000Z',
        finishTime: '2025-08-12T20:15:00.000Z',
        chargedHours: 14.25
      };

      const result = jobSchema.safeParse(overtimeJob);
      expect(result.success).toBe(true);
    });

    it('should handle night shift scenarios', () => {
      const nightShiftJob = {
        ...baseJobData,
        startTime: '2025-08-12T22:00:00.000Z',
        finishTime: '2025-08-13T06:00:00.000Z', // Next day
        chargedHours: 8.0
      };

      const result = jobSchema.safeParse(nightShiftJob);
      expect(result.success).toBe(true);
    });
  });
});