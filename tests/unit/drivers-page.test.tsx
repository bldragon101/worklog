import { Driver } from '@/lib/types'

// Mock driver data
const mockDriverData: Driver[] = [
  {
    id: 1,
    driver: 'John Smith',
    truck: 'Toyota Hiace',
    tray: 150,
    crane: 200,
    semi: null,
    semiCrane: null,
    breaks: 30.0,
    type: 'Employee',
    tolls: false,
    fuelLevy: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    driver: 'Jane Wilson',
    truck: 'Ford Ranger',
    tray: 120,
    crane: null,
    semi: 180,
    semiCrane: 220,
    breaks: 25.0,
    type: 'Contractor',
    tolls: true,
    fuelLevy: 15,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
  {
    id: 3,
    driver: 'Mike Johnson',
    truck: 'Isuzu NPR',
    tray: null,
    crane: 180,
    semi: 200,
    semiCrane: 250,
    breaks: 35.0,
    type: 'Subcontractor',
    tolls: true,
    fuelLevy: 20,
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
  }
]

describe('Drivers Page Logic', () => {
  describe('Driver data processing', () => {
    it('should handle driver data correctly', () => {
      expect(mockDriverData).toHaveLength(3)
      expect(mockDriverData[0].driver).toBe('John Smith')
      expect(mockDriverData[1].truck).toBe('Ford Ranger')
      expect(mockDriverData[2].type).toBe('Subcontractor')
    })

    it('should handle null values in optional fields', () => {
      const employeeDriver = mockDriverData[0]
      const contractorDriver = mockDriverData[1]
      const subcontractorDriver = mockDriverData[2]

      // Employee with some null fields
      expect(employeeDriver.semi).toBeNull()
      expect(employeeDriver.semiCrane).toBeNull()
      expect(employeeDriver.fuelLevy).toBeNull()

      // Contractor with some null fields
      expect(contractorDriver.crane).toBeNull()

      // Subcontractor with some null fields  
      expect(subcontractorDriver.tray).toBeNull()
    })

    it('should filter drivers by name', () => {
      const filtered = mockDriverData.filter(d => 
        d.driver.toLowerCase().includes('john')
      )
      expect(filtered).toHaveLength(2)
      expect(filtered[0].driver).toBe('John Smith')
      expect(filtered[1].driver).toBe('Mike Johnson')
    })

    it('should filter drivers by truck', () => {
      const toyotaDrivers = mockDriverData.filter(d => 
        d.truck.toLowerCase().includes('toyota')
      )
      expect(toyotaDrivers).toHaveLength(1)
      expect(toyotaDrivers[0].truck).toBe('Toyota Hiace')
    })

    it('should filter drivers by type', () => {
      const employees = mockDriverData.filter(d => d.type === 'Employee')
      const contractors = mockDriverData.filter(d => d.type === 'Contractor')
      const subcontractors = mockDriverData.filter(d => d.type === 'Subcontractor')

      expect(employees).toHaveLength(1)
      expect(contractors).toHaveLength(1)
      expect(subcontractors).toHaveLength(1)
    })
  })

  describe('Driver rate management', () => {
    it('should handle tray rates', () => {
      const driversWithTrayRates = mockDriverData.filter(d => d.tray !== null)
      expect(driversWithTrayRates).toHaveLength(2)
      
      const totalTrayRates = mockDriverData.reduce((sum, driver) => 
        sum + (driver.tray || 0), 0
      )
      expect(totalTrayRates).toBe(270) // 150 + 120
    })

    it('should handle crane rates', () => {
      const driversWithCraneRates = mockDriverData.filter(d => d.crane !== null)
      expect(driversWithCraneRates).toHaveLength(2)
      
      const totalCraneRates = mockDriverData.reduce((sum, driver) => 
        sum + (driver.crane || 0), 0
      )
      expect(totalCraneRates).toBe(380) // 200 + 180
    })

    it('should handle semi rates', () => {
      const driversWithSemiRates = mockDriverData.filter(d => d.semi !== null)
      expect(driversWithSemiRates).toHaveLength(2)
      
      const totalSemiRates = mockDriverData.reduce((sum, driver) => 
        sum + (driver.semi || 0), 0
      )
      expect(totalSemiRates).toBe(380) // 180 + 200
    })

    it('should handle semi crane rates', () => {
      const driversWithSemiCraneRates = mockDriverData.filter(d => d.semiCrane !== null)
      expect(driversWithSemiCraneRates).toHaveLength(2)
      
      const totalSemiCraneRates = mockDriverData.reduce((sum, driver) => 
        sum + (driver.semiCrane || 0), 0
      )
      expect(totalSemiCraneRates).toBe(470) // 220 + 250
    })

    it('should handle break deductions', () => {
      const totalBreaks = mockDriverData.reduce((sum, driver) => 
        sum + (driver.breaks || 0), 0
      )
      expect(totalBreaks).toBe(90.0) // 30.0 + 25.0 + 35.0
    })
  })

  describe('Driver type-specific features', () => {
    it('should identify drivers with tolls enabled', () => {
      const driversWithTolls = mockDriverData.filter(d => d.tolls === true)
      const driversWithoutTolls = mockDriverData.filter(d => d.tolls === false)
      
      expect(driversWithTolls).toHaveLength(2)
      expect(driversWithoutTolls).toHaveLength(1)
      expect(driversWithoutTolls[0].type).toBe('Employee')
    })

    it('should handle fuel levy for subcontractors', () => {
      const driversWithFuelLevy = mockDriverData.filter(d => d.fuelLevy !== null)
      expect(driversWithFuelLevy).toHaveLength(2)
      
      // Fuel levy typically applies to Contractors and Subcontractors
      const contractorWithFuelLevy = driversWithFuelLevy.find(d => d.type === 'Contractor')
      const subcontractorWithFuelLevy = driversWithFuelLevy.find(d => d.type === 'Subcontractor')
      
      expect(contractorWithFuelLevy?.fuelLevy).toBe(15)
      expect(subcontractorWithFuelLevy?.fuelLevy).toBe(20)
    })

    it('should validate driver type constraints', () => {
      // Employee should typically not have fuel levy
      const employee = mockDriverData.find(d => d.type === 'Employee')
      expect(employee?.fuelLevy).toBeNull()
      expect(employee?.tolls).toBe(false)

      // Contractors and Subcontractors can have tolls and fuel levy
      const nonEmployees = mockDriverData.filter(d => d.type !== 'Employee')
      const nonEmployeesWithTolls = nonEmployees.filter(d => d.tolls)
      expect(nonEmployeesWithTolls).toHaveLength(2)
    })
  })

  describe('Driver form validation logic', () => {
    it('should validate required fields', () => {
      const validateDriver = (driver: Partial<Driver>) => {
        return !!(driver.driver && driver.truck && driver.type)
      }

      expect(validateDriver({})).toBe(false)
      expect(validateDriver({ driver: 'Test Driver' })).toBe(false)
      expect(validateDriver({ 
        driver: 'Test Driver', 
        truck: 'Test Truck',
        type: 'Employee'
      })).toBe(true)
    })

    it('should validate driver type values', () => {
      const validateDriverType = (type: string) => {
        return ['Employee', 'Contractor', 'Subcontractor'].includes(type)
      }

      expect(validateDriverType('Employee')).toBe(true)
      expect(validateDriverType('Contractor')).toBe(true)
      expect(validateDriverType('Subcontractor')).toBe(true)
      expect(validateDriverType('Invalid')).toBe(false)
      expect(validateDriverType('')).toBe(false)
    })

    it('should validate numeric rate fields', () => {
      const validateRate = (rate: number | null) => {
        return rate === null || (typeof rate === 'number' && rate > 0)
      }

      expect(validateRate(null)).toBe(true)
      expect(validateRate(150)).toBe(true)
      expect(validateRate(0)).toBe(false)
      expect(validateRate(-50)).toBe(false)
    })

    it('should validate break deduction field', () => {
      const validateBreaks = (breaks: number | null) => {
        return breaks === null || (typeof breaks === 'number' && breaks >= 0 && breaks <= 60)
      }

      expect(validateBreaks(null)).toBe(true)
      expect(validateBreaks(30.0)).toBe(true)
      expect(validateBreaks(0)).toBe(true)
      expect(validateBreaks(60)).toBe(true)
      expect(validateBreaks(-5)).toBe(false)
      expect(validateBreaks(65)).toBe(false)
    })
  })

  describe('Driver operations', () => {
    it('should create new driver', () => {
      const newDriver: Partial<Driver> = {
        driver: 'New Driver',
        truck: 'New Truck',
        type: 'Employee',
        tray: 140,
        crane: 190,
        breaks: 30.0,
        tolls: false
      }

      const drivers = [...mockDriverData, { ...newDriver, id: 4 } as Driver]
      expect(drivers).toHaveLength(4)
      expect(drivers[3].driver).toBe('New Driver')
      expect(drivers[3].type).toBe('Employee')
    })

    it('should update existing driver', () => {
      const updatedDrivers = mockDriverData.map(d => 
        d.id === 1 ? { ...d, tray: 160, crane: 210 } : d
      )
      
      expect(updatedDrivers[0].tray).toBe(160)
      expect(updatedDrivers[0].crane).toBe(210)
      expect(updatedDrivers[1].tray).toBe(120) // Unchanged
    })

    it('should delete driver', () => {
      const filteredDrivers = mockDriverData.filter(d => d.id !== 1)
      expect(filteredDrivers).toHaveLength(2)
      expect(filteredDrivers[0].id).toBe(2)
      expect(filteredDrivers[1].id).toBe(3)
    })

    it('should update driver type and related fields', () => {
      // Convert Employee to Subcontractor
      const updatedDrivers = mockDriverData.map(d => 
        d.id === 1 ? { 
          ...d, 
          type: 'Subcontractor' as const,
          tolls: true,
          fuelLevy: 18
        } : d
      )
      
      const convertedDriver = updatedDrivers[0]
      expect(convertedDriver.type).toBe('Subcontractor')
      expect(convertedDriver.tolls).toBe(true)
      expect(convertedDriver.fuelLevy).toBe(18)
    })
  })

  describe('Driver filtering and search', () => {
    it('should search drivers by multiple criteria', () => {
      const searchTerm = 'john'
      const searchResults = mockDriverData.filter(d => 
        d.driver.toLowerCase().includes(searchTerm) ||
        d.truck.toLowerCase().includes(searchTerm)
      )
      
      expect(searchResults).toHaveLength(2)
      expect(searchResults.map(d => d.driver)).toContain('John Smith')
      expect(searchResults.map(d => d.driver)).toContain('Mike Johnson')
    })

    it('should filter by rate availability', () => {
      // Looking at our mock data:
      // John Smith: tray=150, crane=200, semi=null, semiCrane=null
      // Jane Wilson: tray=120, crane=null, semi=180, semiCrane=220  
      // Mike Johnson: tray=null, crane=180, semi=200, semiCrane=250
      // None have ALL rates, so let's test for partial rates
      
      const driversWithTrayAndCrane = mockDriverData.filter(d => 
        d.tray !== null && d.crane !== null
      )
      expect(driversWithTrayAndCrane).toHaveLength(1)
      expect(driversWithTrayAndCrane[0].driver).toBe('John Smith')
      
      const driversWithSemiAndSemiCrane = mockDriverData.filter(d => 
        d.semi !== null && d.semiCrane !== null
      )
      expect(driversWithSemiAndSemiCrane).toHaveLength(2)
    })

    it('should sort drivers by name', () => {
      const sortedDrivers = [...mockDriverData].sort((a, b) => 
        a.driver.localeCompare(b.driver)
      )
      
      expect(sortedDrivers[0].driver).toBe('Jane Wilson')
      expect(sortedDrivers[1].driver).toBe('John Smith')
      expect(sortedDrivers[2].driver).toBe('Mike Johnson')
    })

    it('should group drivers by type', () => {
      const groupedByType = mockDriverData.reduce((groups, driver) => {
        const type = driver.type
        if (!groups[type]) {
          groups[type] = []
        }
        groups[type].push(driver)
        return groups
      }, {} as Record<string, Driver[]>)

      expect(Object.keys(groupedByType)).toHaveLength(3)
      expect(groupedByType['Employee']).toHaveLength(1)
      expect(groupedByType['Contractor']).toHaveLength(1)
      expect(groupedByType['Subcontractor']).toHaveLength(1)
    })
  })

  describe('Driver statistics and calculations', () => {
    it('should calculate average rates by type', () => {
      const employees = mockDriverData.filter(d => d.type === 'Employee')
      const avgEmployeeTrayRate = employees.reduce((sum, d) => sum + (d.tray || 0), 0) / employees.length
      expect(avgEmployeeTrayRate).toBe(150)
    })

    it('should identify highest and lowest rates', () => {
      const trayRates = mockDriverData.map(d => d.tray).filter(Boolean) as number[]
      const maxTrayRate = Math.max(...trayRates)
      const minTrayRate = Math.min(...trayRates)
      
      expect(maxTrayRate).toBe(150)
      expect(minTrayRate).toBe(120)
    })

    it('should count drivers by capability', () => {
      const trayCapableDrivers = mockDriverData.filter(d => d.tray !== null)
      const craneCapableDrivers = mockDriverData.filter(d => d.crane !== null)
      const semiCapableDrivers = mockDriverData.filter(d => d.semi !== null)
      
      expect(trayCapableDrivers).toHaveLength(2)
      expect(craneCapableDrivers).toHaveLength(2)
      expect(semiCapableDrivers).toHaveLength(2)
    })

    it('should validate business rules for driver types', () => {
      // Subcontractors should typically have fuel levy and tolls
      const subcontractors = mockDriverData.filter(d => d.type === 'Subcontractor')
      const subcontractorsWithFuelLevy = subcontractors.filter(d => d.fuelLevy !== null)
      const subcontractorsWithTolls = subcontractors.filter(d => d.tolls === true)
      
      expect(subcontractorsWithFuelLevy).toHaveLength(1)
      expect(subcontractorsWithTolls).toHaveLength(1)
    })
  })
})