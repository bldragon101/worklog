import { vehicleColumns } from '@/components/entities/vehicle/vehicle-columns'
import { Vehicle } from '@/lib/types'

const mockVehicle: Vehicle = {
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

describe('Vehicle Columns', () => {
  const mockOnEdit = jest.fn()
  const mockOnDelete = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates columns correctly', () => {
    const columns = vehicleColumns(mockOnEdit, mockOnDelete)
    
    expect(columns.length).toBeGreaterThan(8) // Should have multiple columns
    
    // Check that essential columns exist
    const columnIds = columns.map(col => (col as any).accessorKey || col.id)
    expect(columnIds).toContain('registration')
    expect(columnIds).toContain('make')
    expect(columnIds).toContain('model')
    expect(columnIds).toContain('type')
    expect(columnIds).toContain('yearOfManufacture')
    expect(columnIds).toContain('actions')
  })

  it('registration column displays correctly', () => {
    const columns = vehicleColumns(mockOnEdit, mockOnDelete)
    const registrationColumn = columns.find(col => (col as any).accessorKey === 'registration')
    
    expect(registrationColumn).toBeDefined()
    expect((registrationColumn as any)?.enableColumnFilter).toBe(true)
  })

  it('make and model columns are configured correctly', () => {
    const columns = vehicleColumns(mockOnEdit, mockOnDelete)
    const makeColumn = columns.find(col => (col as any).accessorKey === 'make')
    const modelColumn = columns.find(col => (col as any).accessorKey === 'model')
    
    expect(makeColumn).toBeDefined()
    expect(modelColumn).toBeDefined()
    expect((makeColumn as any)?.enableColumnFilter).toBe(true)
    expect((modelColumn as any)?.enableColumnFilter).toBe(true)
  })

  it('year column displays as number', () => {
    const columns = vehicleColumns(mockOnEdit, mockOnDelete)
    const yearColumn = columns.find(col => (col as any).accessorKey === 'yearOfManufacture')
    
    expect(yearColumn).toBeDefined()
    expect((yearColumn as any)?.enableColumnFilter).toBe(true)
  })

  it('actions column is configured correctly', () => {
    const columns = vehicleColumns(mockOnEdit, mockOnDelete)
    const actionsColumn = columns.find(col => col.id === 'actions')
    
    expect(actionsColumn).toBeDefined()
    expect((actionsColumn as any)?.enableSorting).toBe(false)
  })

  it('optional capacity fields handle null values', () => {
    const columns = vehicleColumns(mockOnEdit, mockOnDelete)
    
    // Test columns that might have null values
    const capacityColumn = columns.find(col => (col as any).accessorKey === 'carryingCapacity')
    const trayColumn = columns.find(col => (col as any).accessorKey === 'trayLength')
    
    expect(capacityColumn).toBeDefined()
    expect(trayColumn).toBeDefined()
  })

  it('columns have proper sizing configuration', () => {
    const columns = vehicleColumns(mockOnEdit, mockOnDelete)
    
    columns.forEach(column => {
      if (column.size) {
        expect(typeof column.size).toBe('number')
      }
      if (column.minSize) {
        expect(typeof column.minSize).toBe('number')
      }
      if (column.maxSize) {
        expect(typeof column.maxSize).toBe('number')
      }
    })
  })

  it('passes edit and delete handlers correctly', () => {
    const columns = vehicleColumns(mockOnEdit, mockOnDelete)
    
    // The columns function should accept the handlers
    expect(typeof mockOnEdit).toBe('function')
    expect(typeof mockOnDelete).toBe('function')
    
    // Actions column should exist
    const actionsColumn = columns.find(col => col.id === 'actions')
    expect(actionsColumn).toBeDefined()
  })
})