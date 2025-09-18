import {
  jobSchema,
  jobUpdateSchema,
  customerSchema,
  customerUpdateSchema,
  vehicleSchema,
  vehicleUpdateSchema,
  sanitizeInput,
  validateRequestBody,
} from '@/lib/validation'

describe('Validation Schemas', () => {
  describe('jobSchema', () => {
    const validJobData = {
      date: '2024-01-15',
      driver: 'John Doe',
      customer: 'ABC Company',
      billTo: 'ABC Company',
      truckType: 'Tray',
      registration: 'ABC123',
      pickup: '123 Main St',
      dropoff: '456 Oak Ave',
      runsheet: true,
      invoiced: false,
      chargedHours: 8.5,
      driverCharge: 350.00,
      comments: 'Test job',
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: []
    }

    it('validates correct job data', () => {
      const result = jobSchema.safeParse(validJobData)
      expect(result.success).toBe(true)
    })

    it('requires driver field', () => {
      const invalidData = { ...validJobData, driver: '' }
      const result = jobSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Driver is required')
      }
    })

    it('validates date formats', () => {
      const validDate = { ...validJobData, date: '2024-01-15T10:30:00Z' }
      const result = jobSchema.safeParse(validDate)
      expect(result.success).toBe(true)
    })

    it('handles optional fields as null', () => {
      const dataWithNulls = {
        ...validJobData,
        dropoff: null, // dropoff is optional
        comments: null,
        jobReference: null,
        chargedHours: null,
        driverCharge: null,
        startTime: null,
        finishTime: null,
        runsheet: null,
        invoiced: null,
        eastlink: null,
        citylink: null,
        attachmentRunsheet: [],
        attachmentDocket: [],
        attachmentDeliveryPhotos: []
      }
      const result = jobSchema.safeParse(dataWithNulls)
      expect(result.success).toBe(true)
    })

    it('validates positive numbers for charges', () => {
      const invalidData = { ...validJobData, driverCharge: -100 }
      const result = jobSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('customerSchema', () => {
    const validCustomerData = {
      customer: 'Test Customer',
      billTo: 'Test Bill To',
      contact: '1234567890',
      tray: 100,
      crane: 200,
      semi: 300,
      semiCrane: 400,
      fuelLevy: 10,
      tolls: true,
      breakDeduction: 5,
      comments: 'Test comments',
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: []
    }

    it('validates correct customer data', () => {
      const result = customerSchema.safeParse(validCustomerData)
      expect(result.success).toBe(true)
    })

    it('requires customer name', () => {
      const invalidData = { ...validCustomerData, customer: '' }
      const result = customerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Customer name is required')
      }
    })

    it('requires billTo field', () => {
      const invalidData = { ...validCustomerData, billTo: '' }
      const result = customerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Bill To is required')
      }
    })

    it('handles optional numeric fields', () => {
      const dataWithOptionals = {
        customer: 'Test Customer',
        billTo: 'Test Bill To',
        tray: null,
        crane: null,
        tolls: false,
      }
      const result = customerSchema.safeParse(dataWithOptionals)
      expect(result.success).toBe(true)
    })

    it('validates positive numbers for rates', () => {
      const invalidData = { ...validCustomerData, tray: -50 }
      const result = customerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('defaults tolls to false when not provided', () => {
      const dataWithoutTolls = {
        customer: 'Test Customer',
        billTo: 'Test Bill To',
      }
      const result = customerSchema.safeParse(dataWithoutTolls)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tolls).toBe(false)
      }
    })
  })

  describe('vehicleSchema', () => {
    const validVehicleData = {
      registration: 'ABC123',
      expiryDate: '2025-12-31',
      make: 'Toyota',
      model: 'Hiace',
      yearOfManufacture: 2020,
      type: 'Van',
      carryingCapacity: '1000kg',
      trayLength: '3m',
      craneReach: '5m',
      craneType: 'Hydraulic',
      craneCapacity: '2000kg',
    }

    it('validates correct vehicle data', () => {
      const result = vehicleSchema.safeParse(validVehicleData)
      expect(result.success).toBe(true)
    })

    it('requires registration', () => {
      const invalidData = { ...validVehicleData, registration: '' }
      const result = vehicleSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('validates year range', () => {
      const futureYear = { ...validVehicleData, yearOfManufacture: 2030 }
      const result = vehicleSchema.safeParse(futureYear)
      expect(result.success).toBe(true) // Should allow future years within limit

      const tooOldYear = { ...validVehicleData, yearOfManufacture: 1800 }
      const oldResult = vehicleSchema.safeParse(tooOldYear)
      expect(oldResult.success).toBe(false)
    })

    it('handles optional fields', () => {
      const minimalData = {
        registration: 'ABC123',
        expiryDate: '2025-12-31',
        make: 'Toyota',
        model: 'Hiace',
        yearOfManufacture: 2020,
        type: 'Van',
      }
      const result = vehicleSchema.safeParse(minimalData)
      expect(result.success).toBe(true)
    })
  })

  describe('Update schemas', () => {
    it('jobUpdateSchema allows partial updates', () => {
      const partialUpdate = { driver: 'Jane Doe' }
      const result = jobUpdateSchema.safeParse(partialUpdate)
      expect(result.success).toBe(true)
    })

    it('customerUpdateSchema allows partial updates', () => {
      const partialUpdate = { tray: 150 }
      const result = customerUpdateSchema.safeParse(partialUpdate)
      expect(result.success).toBe(true)
    })

    it('vehicleUpdateSchema allows partial updates', () => {
      const partialUpdate = { make: 'Ford' }
      const result = vehicleUpdateSchema.safeParse(partialUpdate)
      expect(result.success).toBe(true)
    })
  })

  describe('sanitizeInput', () => {
    it('trims whitespace from strings', () => {
      const result = sanitizeInput('  test string  ')
      expect(result).toBe('test string')
    })

    it('removes dangerous characters', () => {
      const result = sanitizeInput('<script>alert("xss")</script>')
      expect(result).toBe('scriptalert("xss")/script')
    })

    it('returns non-string values unchanged', () => {
      expect(sanitizeInput(123)).toBe(123)
      expect(sanitizeInput(true)).toBe(true)
      expect(sanitizeInput(null)).toBe(null)
    })

    it('handles empty strings', () => {
      const result = sanitizeInput('')
      expect(result).toBe('')
    })
  })

  describe('validateRequestBody', () => {
    const mockRequest = (body: unknown) => ({
      json: () => Promise.resolve(body),
    } as Request)

    it('validates correct request body', async () => {
      const validData = { customer: 'Test', billTo: 'Test' }
      const request = mockRequest(validData)
      
      const result = await validateRequestBody(request, customerSchema)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.customer).toBe('Test')
      }
    })

    it('returns error for invalid request body', async () => {
      const invalidData = { customer: '', billTo: 'Test' }
      const request = mockRequest(invalidData)
      
      const result = await validateRequestBody(request, customerSchema)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Validation failed')
      }
    })

    it('handles JSON parsing errors', async () => {
      const request = {
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as Request
      
      const result = await validateRequestBody(request, customerSchema)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Invalid request body')
      }
    })
  })
})