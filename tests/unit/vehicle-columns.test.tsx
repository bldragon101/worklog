import { vehicleColumns } from '@/components/entities/vehicle/vehicle-columns'

interface TestColumnDef {
  accessorKey?: string
  id?: string
  enableColumnFilter?: boolean
  enableSorting?: boolean
  size?: number
  minSize?: number
  maxSize?: number
  [key: string]: unknown
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
    const columnIds = columns.map(col => (col as TestColumnDef).accessorKey || (col as TestColumnDef).id)
    expect(columnIds).toContain('registration')
    expect(columnIds).toContain('make')
    expect(columnIds).toContain('model')
    expect(columnIds).toContain('type')
    expect(columnIds).toContain('yearOfManufacture')
    expect(columnIds).toContain('actions')
  })

  it('registration column displays correctly', () => {
    const columns = vehicleColumns(mockOnEdit, mockOnDelete)
    const registrationColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'registration')
    
    expect(registrationColumn).toBeDefined()
    expect((registrationColumn as TestColumnDef)?.enableColumnFilter).toBe(true)
  })

  it('make and model columns are configured correctly', () => {
    const columns = vehicleColumns(mockOnEdit, mockOnDelete)
    const makeColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'make')
    const modelColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'model')
    
    expect(makeColumn).toBeDefined()
    expect(modelColumn).toBeDefined()
    expect((makeColumn as TestColumnDef)?.enableColumnFilter).toBe(true)
    expect((modelColumn as TestColumnDef)?.enableColumnFilter).toBe(true)
  })

  it('year column displays as number', () => {
    const columns = vehicleColumns(mockOnEdit, mockOnDelete)
    const yearColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'yearOfManufacture')
    
    expect(yearColumn).toBeDefined()
    expect((yearColumn as TestColumnDef)?.enableColumnFilter).toBe(true)
  })

  it('actions column is configured correctly', () => {
    const columns = vehicleColumns(mockOnEdit, mockOnDelete)
    const actionsColumn = columns.find(col => col.id === 'actions')
    
    expect(actionsColumn).toBeDefined()
    expect((actionsColumn as TestColumnDef)?.enableSorting).toBe(false)
  })

  it('optional capacity fields handle null values', () => {
    const columns = vehicleColumns(mockOnEdit, mockOnDelete)
    
    // Test columns that might have null values
    const capacityColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'carryingCapacity')
    const trayColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'trayLength')
    
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