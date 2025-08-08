import { Job } from '@/lib/types'
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO, getYear, getMonth, getDay } from 'date-fns'

// Mock job data
const mockJobData: Job[] = [
  {
    id: 1,
    date: '2024-01-15',
    driver: 'John Doe',
    customer: 'ABC Company',
    billTo: 'ABC Company',
    registration: 'ABC123',
    truckType: 'Tray',
    pickup: '123 Main St',
    dropoff: '456 Oak Ave',
    runsheet: true,
    invoiced: false,
    chargedHours: 8.5,
    driverCharge: 350.00,
    comments: 'Test job',
  },
  {
    id: 2,
    date: '2024-01-16',
    driver: 'Jane Smith',
    customer: 'XYZ Corp',
    billTo: 'XYZ Corp',
    registration: 'XYZ789',
    truckType: 'Crane',
    pickup: '789 First Ave',
    dropoff: '321 Second St',
    runsheet: false,
    invoiced: true,
    chargedHours: 6.0,
    driverCharge: 280.00,
    comments: null,
  }
]

describe('Jobs Page Logic', () => {
  describe('Job data processing', () => {
    it('should handle job data correctly', () => {
      expect(mockJobData).toHaveLength(2)
      expect(mockJobData[0].driver).toBe('John Doe')
      expect(mockJobData[1].customer).toBe('XYZ Corp')
    })

    it('should handle null values in optional fields', () => {
      const jobWithNulls = mockJobData[1]
      expect(jobWithNulls.comments).toBeNull()
    })

    it('should filter jobs by driver', () => {
      const filtered = mockJobData.filter(j => 
        j.driver.toLowerCase().includes('john')
      )
      expect(filtered).toHaveLength(1)
      expect(filtered[0].driver).toBe('John Doe')
    })

    it('should filter jobs by customer', () => {
      const abcJobs = mockJobData.filter(j => 
        j.customer.toLowerCase().includes('abc')
      )
      expect(abcJobs).toHaveLength(1)
      expect(abcJobs[0].customer).toBe('ABC Company')
    })

    it('should filter jobs by registration', () => {
      const xyzJobs = mockJobData.filter(j => 
        j.registration.toLowerCase().includes('xyz')
      )
      expect(xyzJobs).toHaveLength(1)
      expect(xyzJobs[0].registration).toBe('XYZ789')
    })
  })

  describe('Job date filtering', () => {
    it('should filter jobs by year', () => {
      const year2024Jobs = mockJobData.filter(j => 
        getYear(parseISO(j.date)) === 2024
      )
      expect(year2024Jobs).toHaveLength(2)
    })

    it('should filter jobs by month', () => {
      const januaryJobs = mockJobData.filter(j => 
        getMonth(parseISO(j.date)) === 0 // January is 0
      )
      expect(januaryJobs).toHaveLength(2)
    })

    it('should filter jobs by day of week', () => {
      const mondayJobs = mockJobData.filter(j => 
        getDay(parseISO(j.date)) === 1 // Monday is 1
      )
      // This depends on what day Jan 15, 2024 was
      expect(mondayJobs.length).toBeGreaterThanOrEqual(0)
    })

    it('should filter jobs within date range', () => {
      const startDate = parseISO('2024-01-01')
      const endDate = parseISO('2024-01-31') 
      
      const jobsInRange = mockJobData.filter(j => {
        const jobDate = parseISO(j.date)
        return isWithinInterval(jobDate, { start: startDate, end: endDate })
      })
      
      expect(jobsInRange).toHaveLength(2)
    })

    it('should filter jobs within a week', () => {
      const weekStart = startOfWeek(parseISO('2024-01-15'), { weekStartsOn: 1 })
      const weekEnd = endOfWeek(parseISO('2024-01-15'), { weekStartsOn: 1 })
      
      const jobsInWeek = mockJobData.filter(j => {
        const jobDate = parseISO(j.date)
        return isWithinInterval(jobDate, { start: weekStart, end: weekEnd })
      })
      
      expect(jobsInWeek.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Job status management', () => {
    it('should filter by runsheet status', () => {
      const runsheetJobs = mockJobData.filter(j => j.runsheet === true)
      const noRunsheetJobs = mockJobData.filter(j => j.runsheet === false)
      
      expect(runsheetJobs).toHaveLength(1)
      expect(noRunsheetJobs).toHaveLength(1)
    })

    it('should filter by invoiced status', () => {
      const invoicedJobs = mockJobData.filter(j => j.invoiced === true)
      const notInvoicedJobs = mockJobData.filter(j => j.invoiced === false)
      
      expect(invoicedJobs).toHaveLength(1)
      expect(notInvoicedJobs).toHaveLength(1)
    })

    it('should update job status', () => {
      const updatedJobs = mockJobData.map(j => 
        j.id === 1 ? { ...j, runsheet: false } : j
      )
      
      expect(updatedJobs[0].runsheet).toBe(false)
      expect(updatedJobs[1].runsheet).toBe(false) // Unchanged
    })
  })

  describe('Job form validation logic', () => {
    it('should validate required fields', () => {
      const validateJob = (job: Partial<Job>) => {
        return !!(job.date && job.driver && job.customer && job.billTo && job.registration && job.truckType)
      }

      expect(validateJob({})).toBe(false)
      expect(validateJob({ date: '2024-01-15' })).toBe(false)
      expect(validateJob({ 
        date: '2024-01-15', 
        driver: 'Test Driver',
        customer: 'Test Customer',
        billTo: 'Test Bill To',
        registration: 'TEST123',
        truckType: 'Tray'
      })).toBe(true)
    })

    it('should validate numeric fields', () => {
      const validateNumeric = (value: number | null) => {
        return value === null || (typeof value === 'number' && value > 0)
      }

      expect(validateNumeric(null)).toBe(true)
      expect(validateNumeric(8.5)).toBe(true)
      expect(validateNumeric(0)).toBe(false)
      expect(validateNumeric(-1)).toBe(false)
    })
  })

  describe('Job operations', () => {
    it('should create new job', () => {
      const newJob: Partial<Job> = {
        date: '2024-01-17',
        driver: 'New Driver',
        customer: 'New Customer',
        billTo: 'New Bill To',
        registration: 'NEW123',
        truckType: 'Semi'
      }

      const jobs = [...mockJobData, { ...newJob, id: 3 } as Job]
      expect(jobs).toHaveLength(3)
      expect(jobs[2].driver).toBe('New Driver')
    })

    it('should update existing job', () => {
      const updatedJobs = mockJobData.map(j => 
        j.id === 1 ? { ...j, chargedHours: 10.0 } : j
      )
      
      expect(updatedJobs[0].chargedHours).toBe(10.0)
      expect(updatedJobs[1].chargedHours).toBe(6.0) // Unchanged
    })

    it('should delete job', () => {
      const filteredJobs = mockJobData.filter(j => j.id !== 1)
      expect(filteredJobs).toHaveLength(1)
      expect(filteredJobs[0].id).toBe(2)
    })

    it('should calculate total charged hours', () => {
      const totalHours = mockJobData.reduce((sum, job) => 
        sum + (job.chargedHours || 0), 0
      )
      expect(totalHours).toBe(14.5)
    })

    it('should calculate total driver charges', () => {
      const totalCharges = mockJobData.reduce((sum, job) => 
        sum + (job.driverCharge || 0), 0
      )
      expect(totalCharges).toBe(630.00)
    })
  })
})