import { Customer, Job, Vehicle, Driver } from '@/lib/types'

describe('Type Definitions', () => {
  describe('Customer type', () => {
    it('should have correct structure', () => {
      const customer: Customer = {
        id: 1,
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
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      expect(customer.id).toBe(1)
      expect(customer.customer).toBe('Test Customer')
      expect(customer.tolls).toBe(true)
    })

    it('should allow null values for optional fields', () => {
      const customer: Customer = {
        id: 1,
        customer: 'Test Customer',
        billTo: 'Test Bill To',
        contact: 'test@example.com',
        tray: null,
        crane: null,
        semi: null,
        semiCrane: null,
        fuelLevy: null,
        tolls: false,
        breakDeduction: null,
        comments: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      expect(customer.tray).toBeNull()
      expect(customer.comments).toBeNull()
    })
  })

  describe('Job type', () => {
    it('should have correct structure', () => {
      const job: Job = {
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
        startTime: '08:00',
        finishTime: '16:30',
        comments: 'Test job',
        jobReference: 'JOB-001',
        eastlink: 2,
        citylink: 1,
        attachmentRunsheet: [],
        attachmentDocket: [],
        attachmentDeliveryPhotos: []
      }

      expect(job.id).toBe(1)
      expect(job.driver).toBe('John Doe')
      expect(job.chargedHours).toBe(8.5)
    })
  })

  describe('Vehicle type', () => {
    it('should have correct structure', () => {
      const vehicle: Vehicle = {
        id: 1,
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
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      expect(vehicle.registration).toBe('ABC123')
      expect(vehicle.yearOfManufacture).toBe(2020)
    })
  })

  describe('Driver type', () => {
    it('should have correct structure', () => {
      const driver: Driver = {
        id: 1,
        driver: 'John Smith',
        type: 'Employee',
        truck: 'ABC123',
        tray: 30,
        crane: 20,
        semi: 10,
        semiCrane: 5,
        fuelLevy: 10,
        tolls: true,
        breaks: 5,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      expect(driver.driver).toBe('John Smith')
      expect(driver.type).toBe('Employee')
    })
  })
})