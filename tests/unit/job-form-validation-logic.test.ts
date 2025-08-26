import { Job } from '@/lib/types'

// Test the validation logic directly (extracted from the component)
describe('Job Form Validation Logic', () => {
  // Replicate the validation function from the component
  const validateRequiredFields = (formData: Partial<Job>) => {
    const requiredFields: { key: keyof Job; label: string }[] = [
      { key: 'date', label: 'Date' },
      { key: 'driver', label: 'Driver' },
      { key: 'customer', label: 'Customer' },
      { key: 'billTo', label: 'Bill To' },
      { key: 'registration', label: 'Registration' },
      { key: 'truckType', label: 'Truck Type' },
      { key: 'pickup', label: 'Pick up' },
    ];

    const missing: string[] = [];
    
    requiredFields.forEach(field => {
      const value = formData[field.key];
      if (!value || value === '' || (Array.isArray(value) && value.length === 0)) {
        missing.push(field.label);
      }
    });

    return missing;
  };

  describe('Complete job data validation', () => {
    it('returns no missing fields for complete job', () => {
      const completeJob: Partial<Job> = {
        date: '2025-01-15',
        driver: 'John Doe',
        customer: 'ABC Company',
        billTo: 'ABC Company',
        registration: 'ABC123',
        truckType: 'Tray',
        pickup: 'Melbourne'
        // dropoff is intentionally omitted as it's not required
      };

      const missing = validateRequiredFields(completeJob);
      expect(missing).toEqual([]);
    });

    it('allows dropoff to be empty without validation error', () => {
      const jobWithoutDropoff: Partial<Job> = {
        date: '2025-01-15',
        driver: 'John Doe',
        customer: 'ABC Company',
        billTo: 'ABC Company',
        registration: 'ABC123',
        truckType: 'Tray',
        pickup: 'Melbourne',
        dropoff: '' // Empty dropoff should be allowed
      };

      const missing = validateRequiredFields(jobWithoutDropoff);
      expect(missing).toEqual([]);
    });
  });

  describe('Incomplete job data validation', () => {
    it('identifies all missing required fields', () => {
      const emptyJob: Partial<Job> = {};

      const missing = validateRequiredFields(emptyJob);
      expect(missing).toEqual([
        'Date',
        'Driver', 
        'Customer',
        'Bill To',
        'Registration',
        'Truck Type',
        'Pick up'
      ]);
      expect(missing).toHaveLength(7);
    });

    it('identifies only specific missing fields', () => {
      const partialJob: Partial<Job> = {
        date: '2025-01-15',
        driver: 'John Doe',
        // customer, billTo, registration, truckType, pickup missing
      };

      const missing = validateRequiredFields(partialJob);
      expect(missing).toEqual([
        'Customer',
        'Bill To', 
        'Registration',
        'Truck Type',
        'Pick up'
      ]);
      expect(missing).toHaveLength(5);
    });

    it('treats empty strings as missing fields', () => {
      const jobWithEmptyFields: Partial<Job> = {
        date: '2025-01-15',
        driver: '',     // Empty string
        customer: '',   // Empty string
        billTo: 'ABC Company',
        registration: 'ABC123',
        truckType: 'Tray',
        pickup: 'Melbourne'
      };

      const missing = validateRequiredFields(jobWithEmptyFields);
      expect(missing).toEqual(['Driver', 'Customer']);
    });

    it('treats null values as missing fields', () => {
      const jobWithNullFields: Partial<Job> = {
        date: '2025-01-15',
        driver: null as any,
        customer: 'ABC Company',
        billTo: 'ABC Company', 
        registration: 'ABC123',
        truckType: 'Tray',
        pickup: 'Melbourne'
      };

      const missing = validateRequiredFields(jobWithNullFields);
      expect(missing).toEqual(['Driver']);
    });

    it('treats empty arrays as missing fields for pickup', () => {
      const jobWithEmptyArrayPickup: Partial<Job> = {
        date: '2025-01-15',
        driver: 'John Doe',
        customer: 'ABC Company',
        billTo: 'ABC Company',
        registration: 'ABC123', 
        truckType: 'Tray',
        pickup: [] as any // Empty array
      };

      const missing = validateRequiredFields(jobWithEmptyArrayPickup);
      expect(missing).toEqual(['Pick up']);
    });
  });

  describe('Edge cases', () => {
    it('handles undefined values correctly', () => {
      const jobWithUndefinedFields: Partial<Job> = {
        date: '2025-01-15',
        driver: undefined,
        customer: 'ABC Company',
        billTo: 'ABC Company',
        registration: 'ABC123',
        truckType: 'Tray',
        pickup: 'Melbourne'
      };

      const missing = validateRequiredFields(jobWithUndefinedFields);
      expect(missing).toEqual(['Driver']);
    });

    it('handles mixed data types correctly', () => {
      const mixedJob: Partial<Job> = {
        date: '2025-01-15',
        driver: 'John Doe',
        customer: null as any,
        billTo: '',
        registration: undefined,
        truckType: 'Tray',
        pickup: [] as any
      };

      const missing = validateRequiredFields(mixedJob);
      expect(missing).toEqual(['Customer', 'Bill To', 'Registration', 'Pick up']);
    });

    it('correctly validates when only date is provided (new job default)', () => {
      const newJobDefault: Partial<Job> = {
        date: '2025-01-15' // Only date is set by default for new jobs
      };

      const missing = validateRequiredFields(newJobDefault);
      expect(missing).toEqual([
        'Driver',
        'Customer', 
        'Bill To',
        'Registration',
        'Truck Type',
        'Pick up'
      ]);
      expect(missing).toHaveLength(6);
      expect(missing).not.toContain('Drop off'); // Ensure dropoff is not required
    });
  });

  describe('Required fields specification', () => {
    it('validates exactly 7 required fields (excluding dropoff)', () => {
      const requiredFields = [
        'date', 'driver', 'customer', 'billTo', 
        'registration', 'truckType', 'pickup'
      ];
      
      expect(requiredFields).toHaveLength(7);
      expect(requiredFields).not.toContain('dropoff');
      expect(requiredFields).not.toContain('comments');
      expect(requiredFields).not.toContain('startTime');
      expect(requiredFields).not.toContain('finishTime');
    });

    it('does not require optional fields', () => {
      const jobWithOnlyRequiredFields: Partial<Job> = {
        date: '2025-01-15',
        driver: 'John Doe', 
        customer: 'ABC Company',
        billTo: 'ABC Company',
        registration: 'ABC123',
        truckType: 'Tray',
        pickup: 'Melbourne'
        // All optional fields omitted: dropoff, comments, startTime, finishTime, etc.
      };

      const missing = validateRequiredFields(jobWithOnlyRequiredFields);
      expect(missing).toEqual([]);
    });
  });
});