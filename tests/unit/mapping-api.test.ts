/**
 * Unit tests for the mapping API logic and data transformations
 */

// Test data transformation functions for mapping APIs

// Helper function to create customer to billTo mappings (from API logic)
const createCustomerToBillToMapping = (customers: Array<{ customer: string; billTo: string }>) => {
  const customerToBillTo: Record<string, string> = {};
  customers.forEach(c => {
    customerToBillTo[c.customer] = c.billTo;
  });
  return customerToBillTo;
};

// Helper function to create registration to type mappings (from API logic)
const createRegistrationToTypeMapping = (vehicles: Array<{ registration: string; type: string }>) => {
  const registrationToType: Record<string, string> = {};
  vehicles.forEach(v => {
    registrationToType[v.registration] = v.type;
  });
  return registrationToType;
};

// Helper function to create driver to truck mappings (from API logic)
const createDriverToTruckMapping = (drivers: Array<{ driver: string; truck: string }>) => {
  const driverToTruck: Record<string, string> = {};
  drivers.forEach(d => {
    driverToTruck[d.driver] = d.truck;
  });
  return driverToTruck;
};

describe('Mapping Data Transformations', () => {
  describe('Customer to BillTo mapping', () => {
    const mockCustomers = [
      { customer: 'ABC Company', billTo: 'ABC Billing' },
      { customer: 'XYZ Corp', billTo: 'XYZ Finance' },
      { customer: 'Tilling', billTo: 'Xperia Group' }
    ]

    it('creates correct customer to billTo mappings', () => {
      const result = createCustomerToBillToMapping(mockCustomers)
      
      expect(result).toEqual({
        'ABC Company': 'ABC Billing',
        'XYZ Corp': 'XYZ Finance',
        'Tilling': 'Xperia Group'
      })
    })

    it('handles empty customer list', () => {
      const result = createCustomerToBillToMapping([])
      expect(result).toEqual({})
    })

    it('handles duplicate customer names (last one wins)', () => {
      const duplicateCustomers = [
        { customer: 'ABC Company', billTo: 'First Billing' },
        { customer: 'ABC Company', billTo: 'Second Billing' }
      ]
      
      const result = createCustomerToBillToMapping(duplicateCustomers)
      expect(result).toEqual({
        'ABC Company': 'Second Billing'
      })
    })

    it('handles special characters in customer names', () => {
      const specialCustomers = [
        { customer: 'A & B Company', billTo: 'A & B Billing' },
        { customer: "O'Connor Ltd", billTo: "O'Connor Finance" },
        { customer: 'Company-Name', billTo: 'Company-Billing' }
      ]
      
      const result = createCustomerToBillToMapping(specialCustomers)
      expect(result).toEqual({
        'A & B Company': 'A & B Billing',
        "O'Connor Ltd": "O'Connor Finance",
        'Company-Name': 'Company-Billing'
      })
    })
  })

  describe('Registration to Type mapping', () => {
    const mockVehicles = [
      { registration: 'ABC123', type: 'Tray' },
      { registration: 'XYZ789', type: 'Van' },
      { registration: 'DEF456', type: 'Crane' }
    ]

    it('creates correct registration to type mappings', () => {
      const result = createRegistrationToTypeMapping(mockVehicles)
      
      expect(result).toEqual({
        'ABC123': 'Tray',
        'XYZ789': 'Van',
        'DEF456': 'Crane'
      })
    })

    it('handles empty vehicle list', () => {
      const result = createRegistrationToTypeMapping([])
      expect(result).toEqual({})
    })

    it('handles duplicate registrations (last one wins)', () => {
      const duplicateVehicles = [
        { registration: 'ABC123', type: 'Tray' },
        { registration: 'ABC123', type: 'Van' }
      ]
      
      const result = createRegistrationToTypeMapping(duplicateVehicles)
      expect(result).toEqual({
        'ABC123': 'Van'
      })
    })

    it('handles various registration formats', () => {
      const variousRegistrations = [
        { registration: 'ABC-123', type: 'Tray' },
        { registration: 'xyz789', type: 'Van' },
        { registration: '123ABC', type: 'Crane' }
      ]
      
      const result = createRegistrationToTypeMapping(variousRegistrations)
      expect(result).toEqual({
        'ABC-123': 'Tray',
        'xyz789': 'Van',
        '123ABC': 'Crane'
      })
    })
  })

  describe('Driver to Truck mapping', () => {
    const mockDrivers = [
      { driver: 'John Doe', truck: 'ABC123' },
      { driver: 'Jane Smith', truck: 'XYZ789' },
      { driver: 'Bob Wilson', truck: 'DEF456' }
    ]

    it('creates correct driver to truck mappings', () => {
      const result = createDriverToTruckMapping(mockDrivers)
      
      expect(result).toEqual({
        'John Doe': 'ABC123',
        'Jane Smith': 'XYZ789',
        'Bob Wilson': 'DEF456'
      })
    })

    it('handles empty driver list', () => {
      const result = createDriverToTruckMapping([])
      expect(result).toEqual({})
    })

    it('handles duplicate driver names (last one wins)', () => {
      const duplicateDrivers = [
        { driver: 'John Doe', truck: 'ABC123' },
        { driver: 'John Doe', truck: 'XYZ789' }
      ]
      
      const result = createDriverToTruckMapping(duplicateDrivers)
      expect(result).toEqual({
        'John Doe': 'XYZ789'
      })
    })

    it('handles various driver name formats', () => {
      const variousDrivers = [
        { driver: 'John Doe Jr.', truck: 'ABC123' },
        { driver: "O'Connor", truck: 'XYZ789' },
        { driver: 'Mary Jane Smith-Wilson', truck: 'DEF456' }
      ]
      
      const result = createDriverToTruckMapping(variousDrivers)
      expect(result).toEqual({
        'John Doe Jr.': 'ABC123',
        "O'Connor": 'XYZ789',
        'Mary Jane Smith-Wilson': 'DEF456'
      })
    })
  })

  describe('Integration scenarios', () => {
    it('handles consistent data across all mappings', () => {
      const customers = [{ customer: 'ABC Company', billTo: 'ABC Billing' }]
      const vehicles = [{ registration: 'ABC123', type: 'Tray' }]
      const drivers = [{ driver: 'John Doe', truck: 'ABC123' }]

      createCustomerToBillToMapping(customers)
      const vehicleMapping = createRegistrationToTypeMapping(vehicles)
      const driverMapping = createDriverToTruckMapping(drivers)

      // Check that the truck registration is consistent across mappings
      expect(driverMapping['John Doe']).toBe('ABC123')
      expect(vehicleMapping['ABC123']).toBe('Tray')
      
      // This demonstrates the auto-population chain: Driver -> Registration -> Truck Type
      const driverTruck = driverMapping['John Doe']
      const truckType = vehicleMapping[driverTruck]
      expect(truckType).toBe('Tray')
    })

    it('handles empty or missing relationships gracefully', () => {
      const customers: Array<{ customer: string; billTo: string }> = []
      const vehicles: Array<{ registration: string; type: string }> = []
      const drivers: Array<{ driver: string; truck: string }> = []

      const customerMapping = createCustomerToBillToMapping(customers)
      const vehicleMapping = createRegistrationToTypeMapping(vehicles)
      const driverMapping = createDriverToTruckMapping(drivers)

      expect(customerMapping).toEqual({})
      expect(vehicleMapping).toEqual({})
      expect(driverMapping).toEqual({})
    })

    it('demonstrates the auto-population use case', () => {
      // Example data showing the relationships used in auto-population
      const customers = [{ customer: 'Tilling', billTo: 'Xperia Group' }]
      const vehicles = [{ registration: 'TRUCK001', type: 'Crane' }]
      const drivers = [{ driver: 'John Smith', truck: 'TRUCK001' }]

      const customerMapping = createCustomerToBillToMapping(customers)
      const vehicleMapping = createRegistrationToTypeMapping(vehicles)
      const driverMapping = createDriverToTruckMapping(drivers)

      // Simulate auto-population workflow:
      // 1. User selects customer "Tilling" -> auto-populate "Xperia Group" for billTo
      expect(customerMapping['Tilling']).toBe('Xperia Group')

      // 2. User selects driver "John Smith" -> auto-populate "TRUCK001" for registration
      expect(driverMapping['John Smith']).toBe('TRUCK001')

      // 3. Registration "TRUCK001" -> auto-populate "Crane" for truck type
      expect(vehicleMapping['TRUCK001']).toBe('Crane')
    })
  })
});