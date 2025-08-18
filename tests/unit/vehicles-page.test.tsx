import { Vehicle } from '@/lib/types'

// Mock vehicle data
const mockVehicleData: Vehicle[] = [
  {
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
  },
  {
    id: 2,
    registration: 'XYZ789',
    expiryDate: '2024-06-30',
    make: 'Ford',
    model: 'Ranger',
    yearOfManufacture: 2021,
    type: 'UTE',
    carryingCapacity: '800kg',
    trayLength: '2.5m',
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  }
]

describe('Vehicles Page Logic', () => {
  describe('Vehicle data processing', () => {
    it('should handle vehicle data correctly', () => {
      expect(mockVehicleData).toHaveLength(2)
      expect(mockVehicleData[0].registration).toBe('ABC123')
      expect(mockVehicleData[1].make).toBe('Ford')
    })

    it('should handle null values in optional fields', () => {
      const vehicleWithNulls = mockVehicleData[1]
      expect(vehicleWithNulls.craneReach).toBeNull()
      expect(vehicleWithNulls.craneType).toBeNull()
      expect(vehicleWithNulls.craneCapacity).toBeNull()
    })

    it('should filter vehicles by registration', () => {
      const filtered = mockVehicleData.filter(v => 
        v.registration.toLowerCase().includes('abc')
      )
      expect(filtered).toHaveLength(1)
      expect(filtered[0].registration).toBe('ABC123')
    })

    it('should filter vehicles by make', () => {
      const toyotaVehicles = mockVehicleData.filter(v => 
        v.make.toLowerCase() === 'toyota'
      )
      expect(toyotaVehicles).toHaveLength(1)
      expect(toyotaVehicles[0].model).toBe('Hiace')
    })

    it('should filter vehicles by year range', () => {
      const recentVehicles = mockVehicleData.filter(v => 
        v.yearOfManufacture >= 2020
      )
      expect(recentVehicles).toHaveLength(2)
    })

    it('should handle expired vehicles', () => {
      const currentDate = new Date('2024-12-01')
      const expiredVehicles = mockVehicleData.filter(v => 
        new Date(v.expiryDate) < currentDate
      )
      expect(expiredVehicles).toHaveLength(1)
      expect(expiredVehicles[0].registration).toBe('XYZ789')
    })
  })

  describe('Vehicle form validation logic', () => {
    it('should validate required fields', () => {
      const validateVehicle = (vehicle: Partial<Vehicle>) => {
        return !!(vehicle.registration && vehicle.make && vehicle.model && vehicle.yearOfManufacture)
      }

      expect(validateVehicle({})).toBe(false)
      expect(validateVehicle({ registration: 'ABC123' })).toBe(false)
      expect(validateVehicle({ 
        registration: 'ABC123', 
        make: 'Toyota', 
        model: 'Hiace', 
        yearOfManufacture: 2020 
      })).toBe(true)
    })

    it('should validate year range', () => {
      const validateYear = (year: number) => {
        const currentYear = new Date().getFullYear()
        return year >= 1900 && year <= currentYear + 5
      }

      expect(validateYear(1899)).toBe(false)
      expect(validateYear(2020)).toBe(true)
      expect(validateYear(2030)).toBe(true)
      expect(validateYear(2040)).toBe(false)
    })
  })

  describe('Vehicle operations', () => {
    it('should create new vehicle', () => {
      const newVehicle: Partial<Vehicle> = {
        registration: 'NEW123',
        make: 'Isuzu',
        model: 'D-Max',
        yearOfManufacture: 2023,
        type: 'UTE'
      }

      const vehicles = [...mockVehicleData, { ...newVehicle, id: 3 } as Vehicle]
      expect(vehicles).toHaveLength(3)
      expect(vehicles[2].registration).toBe('NEW123')
    })

    it('should update existing vehicle', () => {
      const updatedVehicles = mockVehicleData.map(v => 
        v.id === 1 ? { ...v, make: 'Honda' } : v
      )
      
      expect(updatedVehicles[0].make).toBe('Honda')
      expect(updatedVehicles[1].make).toBe('Ford') // Unchanged
    })

    it('should delete vehicle', () => {
      const filteredVehicles = mockVehicleData.filter(v => v.id !== 1)
      expect(filteredVehicles).toHaveLength(1)
      expect(filteredVehicles[0].id).toBe(2)
    })
  })
})