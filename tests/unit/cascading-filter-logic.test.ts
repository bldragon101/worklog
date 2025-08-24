import type { Job } from '@/lib/types';

// Extract the filtering logic for isolated testing
class FilterLogic {
  static getFilteredData(
    allData: Job[],
    customFilters: Record<string, string[]>
  ): Job[] {
    if (Object.keys(customFilters).length === 0) {
      return allData;
    }

    return allData.filter((job) => {
      return Object.entries(customFilters).every(([columnId, filterValues]) => {
        if (filterValues.length === 0) return true;

        const jobValue = job[columnId as keyof Job] as string;
        return filterValues.includes(jobValue);
      });
    });
  }

  static countValues(values: string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    values.forEach((value) => {
      counts[value] = (counts[value] || 0) + 1;
    });
    return counts;
  }

  static updateFilterOptions(data: Job[]) {
    if (data.length === 0) {
      return {
        dateOptions: [],
        driverOptions: [],
        customerOptions: [],
        billToOptions: [],
        registrationOptions: [],
        truckTypeOptions: [],
        runsheetOptions: [],
        invoicedOptions: [],
      };
    }

    // Get values and counts for each column
    const dates = data
      .map((job) => job.date)
      .filter((value) => value && value.trim());
    const drivers = data
      .map((job) => job.driver)
      .filter((value) => value && value.trim());
    const customers = data
      .map((job) => job.customer)
      .filter((value) => value && value.trim());
    const billTos = data
      .map((job) => job.billTo)
      .filter((value) => value && value.trim());
    const registrations = data
      .map((job) => job.registration)
      .filter((value) => value && value.trim());
    const truckTypes = data
      .map((job) => job.truckType)
      .filter((value) => value && value.trim());
    const runsheets = data.map((job) => (job.runsheet ? 'true' : 'false'));
    const invoiced = data.map((job) => (job.invoiced ? 'true' : 'false'));

    // Count occurrences
    const dateCounts = this.countValues(dates);
    const driverCounts = this.countValues(drivers);
    const customerCounts = this.countValues(customers);
    const billToCounts = this.countValues(billTos);
    const registrationCounts = this.countValues(registrations);
    const truckTypeCounts = this.countValues(truckTypes);
    const runsheetCounts = this.countValues(runsheets);
    const invoicedCounts = this.countValues(invoiced);

    // Get unique values and sort
    const uniqueDates = [...new Set(dates)].sort();
    const uniqueDrivers = [...new Set(drivers)].sort();
    const uniqueCustomers = [...new Set(customers)].sort();
    const uniqueBillTos = [...new Set(billTos)].sort();
    const uniqueRegistrations = [...new Set(registrations)].sort();
    const uniqueTruckTypes = [...new Set(truckTypes)].sort();

    return {
      dateOptions: uniqueDates.map((value) => ({
        label: value,
        value,
        count: dateCounts[value],
      })),
      driverOptions: uniqueDrivers.map((value) => ({
        label: value,
        value,
        count: driverCounts[value],
      })),
      customerOptions: uniqueCustomers.map((value) => ({
        label: value,
        value,
        count: customerCounts[value],
      })),
      billToOptions: uniqueBillTos.map((value) => ({
        label: value,
        value,
        count: billToCounts[value],
      })),
      registrationOptions: uniqueRegistrations.map((value) => ({
        label: value,
        value,
        count: registrationCounts[value],
      })),
      truckTypeOptions: uniqueTruckTypes.map((value) => ({
        label: value,
        value,
        count: truckTypeCounts[value],
      })),
      runsheetOptions: [
        { label: 'Yes', value: 'true', count: runsheetCounts['true'] || 0 },
        { label: 'No', value: 'false', count: runsheetCounts['false'] || 0 },
      ],
      invoicedOptions: [
        { label: 'Yes', value: 'true', count: invoicedCounts['true'] || 0 },
        { label: 'No', value: 'false', count: invoicedCounts['false'] || 0 },
      ],
    };
  }
}

// Test data
const mockJobs: Job[] = [
  {
    id: 1,
    date: '2024-01-15',
    driver: 'SIMRAN',
    customer: 'Tilling',
    billTo: 'Tilling Ltd',
    registration: 'ABC123',
    truckType: 'TRAY',
    pickup: 'Location A',
    dropoff: 'Location B',
    runsheet: true,
    invoiced: false,
    startTime: '08:00',
    finishTime: '16:00',
    chargedHours: 8,
    driverCharge: 400,
    comments: 'Test job 1',
    jobReference: 'JOB-001',
    eastlink: 2,
    citylink: 1,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: []
  },
  {
    id: 2,
    date: '2024-01-15',
    driver: 'SIMRAN',
    customer: 'Tilling',
    billTo: 'Tilling Ltd',
    registration: 'ABC123',
    truckType: 'TRAY',
    pickup: 'Location C',
    dropoff: 'Location D',
    runsheet: false,
    invoiced: true,
    startTime: '09:00',
    finishTime: '17:00',
    chargedHours: 8,
    driverCharge: 400,
    comments: 'Test job 2',
    jobReference: 'JOB-002',
    eastlink: 1,
    citylink: 2,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: []
  },
  {
    id: 3,
    date: '2024-01-16',
    driver: 'STEWART',
    customer: 'Bayswood',
    billTo: 'Bayswood Pty',
    registration: 'XYZ789',
    truckType: 'CRANE',
    pickup: 'Location E',
    dropoff: 'Location F',
    runsheet: true,
    invoiced: false,
    startTime: '07:00',
    finishTime: '15:00',
    chargedHours: 8,
    driverCharge: 450,
    comments: 'Test job 3',
    jobReference: null,
    eastlink: 3,
    citylink: 0,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: []
  },
  {
    id: 4,
    date: '2024-01-16',
    driver: 'GAGANDEEP',
    customer: 'Ace Reo',
    billTo: 'Ace Reo Ltd',
    registration: 'DEF456',
    truckType: 'SEMI',
    pickup: 'Location G',
    dropoff: 'Location H',
    runsheet: false,
    invoiced: false,
    startTime: '06:00',
    finishTime: '14:00',
    chargedHours: 8,
    driverCharge: 500,
    comments: 'Test job 4',
    jobReference: 'JOB-004',
    eastlink: 0,
    citylink: 3,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: []
  },
  {
    id: 5,
    date: '2024-01-17',
    driver: 'SIMRAN',
    customer: 'Ace Reo',
    billTo: 'Ace Reo Ltd',
    registration: 'ABC123',
    truckType: 'TRAY',
    pickup: 'Location I',
    dropoff: 'Location J',
    runsheet: true,
    invoiced: true,
    startTime: '08:30',
    finishTime: '16:30',
    chargedHours: 8,
    driverCharge: 400,
    comments: 'Test job 5',
    jobReference: 'JOB-005',
    eastlink: 1,
    citylink: 1,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: []
  },
];

describe('Cascading Filter Logic', () => {
  describe('getFilteredData', () => {
    it('should return all data when no filters are applied', () => {
      const result = FilterLogic.getFilteredData(mockJobs, {});
      expect(result).toEqual(mockJobs);
    });

    it('should filter by single column correctly', () => {
      const customFilters = { driver: ['SIMRAN'] };
      const result = FilterLogic.getFilteredData(mockJobs, customFilters);
      
      expect(result).toHaveLength(3);
      expect(result.every(job => job.driver === 'SIMRAN')).toBe(true);
    });

    it('should filter by multiple values in same column', () => {
      const customFilters = { driver: ['SIMRAN', 'STEWART'] };
      const result = FilterLogic.getFilteredData(mockJobs, customFilters);
      
      expect(result).toHaveLength(4);
      expect(result.every(job => ['SIMRAN', 'STEWART'].includes(job.driver))).toBe(true);
    });

    it('should filter by multiple columns (intersection)', () => {
      const customFilters = { 
        driver: ['SIMRAN'], 
        customer: ['Tilling'] 
      };
      const result = FilterLogic.getFilteredData(mockJobs, customFilters);
      
      expect(result).toHaveLength(2);
      expect(result.every(job => job.driver === 'SIMRAN' && job.customer === 'Tilling')).toBe(true);
    });

    it('should return empty array when no jobs match filters', () => {
      const customFilters = { 
        driver: ['SIMRAN'], 
        customer: ['NonExistentCustomer'] 
      };
      const result = FilterLogic.getFilteredData(mockJobs, customFilters);
      
      expect(result).toHaveLength(0);
    });

    it('should handle empty filter values (should include all)', () => {
      const customFilters = { 
        driver: [], 
        customer: ['Tilling'] 
      };
      const result = FilterLogic.getFilteredData(mockJobs, customFilters);
      
      expect(result).toHaveLength(2);
      expect(result.every(job => job.customer === 'Tilling')).toBe(true);
    });
  });

  describe('countValues', () => {
    it('should count occurrences correctly', () => {
      const values = ['A', 'B', 'A', 'C', 'B', 'A'];
      const result = FilterLogic.countValues(values);
      
      expect(result).toEqual({
        A: 3,
        B: 2,
        C: 1,
      });
    });

    it('should handle empty array', () => {
      const result = FilterLogic.countValues([]);
      expect(result).toEqual({});
    });

    it('should handle single value', () => {
      const result = FilterLogic.countValues(['single']);
      expect(result).toEqual({ single: 1 });
    });
  });

  describe('updateFilterOptions', () => {
    it('should return empty options when no data', () => {
      const result = FilterLogic.updateFilterOptions([]);
      
      Object.values(result).forEach(options => {
        expect(options).toHaveLength(0);
      });
    });

    it('should calculate correct counts for all filter options', () => {
      const result = FilterLogic.updateFilterOptions(mockJobs);
      
      // Check driver counts
      expect(result.driverOptions).toEqual([
        { label: 'GAGANDEEP', value: 'GAGANDEEP', count: 1 },
        { label: 'SIMRAN', value: 'SIMRAN', count: 3 },
        { label: 'STEWART', value: 'STEWART', count: 1 },
      ]);

      // Check customer counts
      expect(result.customerOptions).toEqual([
        { label: 'Ace Reo', value: 'Ace Reo', count: 2 },
        { label: 'Bayswood', value: 'Bayswood', count: 1 },
        { label: 'Tilling', value: 'Tilling', count: 2 },
      ]);

      // Check boolean filters
      expect(result.runsheetOptions).toEqual([
        { label: 'Yes', value: 'true', count: 3 },
        { label: 'No', value: 'false', count: 2 },
      ]);

      expect(result.invoicedOptions).toEqual([
        { label: 'Yes', value: 'true', count: 2 },
        { label: 'No', value: 'false', count: 3 },
      ]);
    });

    it('should filter out null/empty values', () => {
      const dataWithNulls: Job[] = [
        {
          ...mockJobs[0],
          driver: '',
          customer: null as any,
          billTo: '   ', // Whitespace only
        },
        {
          ...mockJobs[1],
          driver: 'VALID_DRIVER',
          customer: 'VALID_CUSTOMER',
          billTo: '', // Empty string
        },
      ];

      const result = FilterLogic.updateFilterOptions(dataWithNulls);
      
      expect(result.driverOptions).toEqual([
        { label: 'VALID_DRIVER', value: 'VALID_DRIVER', count: 1 },
      ]);
      
      expect(result.customerOptions).toEqual([
        { label: 'VALID_CUSTOMER', value: 'VALID_CUSTOMER', count: 1 },
      ]);
      
      expect(result.billToOptions).toHaveLength(0); // Empty/whitespace values should be filtered out
    });

    it('should sort options alphabetically', () => {
      const result = FilterLogic.updateFilterOptions(mockJobs);
      
      const driverLabels = result.driverOptions.map(opt => opt.label);
      expect(driverLabels).toEqual(['GAGANDEEP', 'SIMRAN', 'STEWART']);
      
      const customerLabels = result.customerOptions.map(opt => opt.label);
      expect(customerLabels).toEqual(['Ace Reo', 'Bayswood', 'Tilling']);
    });
  });

  describe('Cascading Filter Integration', () => {
    it('should demonstrate cascading behavior correctly', () => {
      // Step 1: No filters - all options available
      const allOptions = FilterLogic.updateFilterOptions(mockJobs);
      expect(allOptions.driverOptions).toHaveLength(3);
      expect(allOptions.customerOptions).toHaveLength(3);

      // Step 2: Filter by SIMRAN driver
      const simranFiltered = FilterLogic.getFilteredData(mockJobs, { driver: ['SIMRAN'] });
      const simranOptions = FilterLogic.updateFilterOptions(simranFiltered);
      
      // Should only show customers that SIMRAN works for
      expect(simranOptions.customerOptions).toEqual([
        { label: 'Ace Reo', value: 'Ace Reo', count: 1 },
        { label: 'Tilling', value: 'Tilling', count: 2 },
      ]);
      
      // Should not show Bayswood since SIMRAN doesn't work for them
      expect(simranOptions.customerOptions.find(opt => opt.value === 'Bayswood')).toBeUndefined();

      // Step 3: Further filter by Tilling customer
      const doubleFiltered = FilterLogic.getFilteredData(mockJobs, { 
        driver: ['SIMRAN'], 
        customer: ['Tilling'] 
      });
      const doubleFilteredOptions = FilterLogic.updateFilterOptions(doubleFiltered);
      
      // Should only show truck types used by SIMRAN for Tilling
      expect(doubleFilteredOptions.truckTypeOptions).toEqual([
        { label: 'TRAY', value: 'TRAY', count: 2 },
      ]);
      
      // Should not show CRANE or SEMI
      expect(doubleFilteredOptions.truckTypeOptions.find(opt => opt.value === 'CRANE')).toBeUndefined();
      expect(doubleFilteredOptions.truckTypeOptions.find(opt => opt.value === 'SEMI')).toBeUndefined();
    });

    it('should handle complex multi-filter scenarios', () => {
      // Filter by multiple drivers and a specific truck type
      const complexFiltered = FilterLogic.getFilteredData(mockJobs, {
        driver: ['SIMRAN', 'STEWART'],
        truckType: ['TRAY', 'CRANE']
      });
      
      expect(complexFiltered).toHaveLength(4); // 3 SIMRAN TRAY jobs + 1 STEWART CRANE job
      
      const complexOptions = FilterLogic.updateFilterOptions(complexFiltered);
      
      // Customers should be limited to those served by SIMRAN or STEWART with TRAY/CRANE trucks
      expect(complexOptions.customerOptions).toEqual([
        { label: 'Ace Reo', value: 'Ace Reo', count: 1 },
        { label: 'Bayswood', value: 'Bayswood', count: 1 },
        { label: 'Tilling', value: 'Tilling', count: 2 },
      ]);
    });

    it('should handle edge case where filters result in no data', () => {
      const noDataFiltered = FilterLogic.getFilteredData(mockJobs, {
        driver: ['SIMRAN'],
        customer: ['Bayswood'] // SIMRAN doesn't work for Bayswood
      });
      
      expect(noDataFiltered).toHaveLength(0);
      
      const noDataOptions = FilterLogic.updateFilterOptions(noDataFiltered);
      
      // All options should be empty
      Object.values(noDataOptions).forEach(options => {
        if (Array.isArray(options)) {
          expect(options).toHaveLength(0);
        }
      });
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large datasets efficiently', () => {
      // Create a large dataset
      const largeDataset: Job[] = Array.from({ length: 1000 }, (_, i) => ({
        ...mockJobs[i % mockJobs.length],
        id: i + 1,
        comments: `Job ${i + 1}`,
        jobReference: `JOB-${String(i + 1).padStart(3, '0')}`,
        eastlink: Math.floor(Math.random() * 4),
        citylink: Math.floor(Math.random() * 4),
        attachmentRunsheet: [],
        attachmentDocket: [],
        attachmentDeliveryPhotos: []
      }));

      const start = performance.now();
      
      // Apply complex filters
      const filtered = FilterLogic.getFilteredData(largeDataset, {
        driver: ['SIMRAN'],
        truckType: ['TRAY']
      });
      
      const options = FilterLogic.updateFilterOptions(filtered);
      
      const end = performance.now();
      
      // Should complete within reasonable time (less than 100ms for 1000 records)
      expect(end - start).toBeLessThan(100);
      
      // Should still produce correct results
      expect(filtered.every(job => job.driver === 'SIMRAN' && job.truckType === 'TRAY')).toBe(true);
      expect(options.driverOptions).toEqual([
        { label: 'SIMRAN', value: 'SIMRAN', count: filtered.length }
      ]);
    });
  });
});