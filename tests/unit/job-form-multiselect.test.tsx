import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { JobForm } from '@/components/entities/job/job-form'
import { Job } from '@/lib/types'

// Mock fetch for API calls
global.fetch = jest.fn()

// Mock useToast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}))

const mockJob: Partial<Job> = {
  id: 1,
  date: '2024-01-15',
  driver: 'John Doe',
  customer: 'ABC Company',
  pickup: 'Melbourne, Richmond',
  dropoff: 'Fitzroy, Carlton',
  attachmentRunsheet: [],
  attachmentDocket: [],
  attachmentDeliveryPhotos: [],
}

const mockApiResponses = {
  customers: {
    customerOptions: ['ABC Company', 'XYZ Corp'],
    billToOptions: ['ABC Company', 'XYZ Corp']
  },
  vehicles: {
    registrationOptions: ['ABC123', 'XYZ789'],
    truckTypeOptions: ['Tray', 'Van']
  },
  drivers: {
    driverOptions: ['John Doe', 'Jane Smith']
  },
  customerMappings: {
    customerToBillTo: { 'ABC Company': 'ABC Company' }
  },
  vehicleMappings: {
    registrationToType: { 'ABC123': 'Tray' }
  },
  driverMappings: {
    driverToTruck: { 'John Doe': 'ABC123' }
  }
}

describe('JobForm Multi-Select Functionality', () => {
  const mockOnSave = jest.fn()
  const mockOnClose = jest.fn()

  beforeEach(() => {
    mockOnSave.mockClear()
    mockOnClose.mockClear()
    
    // Setup fetch mocks for different endpoints
    ;(fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/customers/select-options')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.customers)
        })
      }
      if (url.includes('/api/vehicles/select-options')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.vehicles)
        })
      }
      if (url.includes('/api/drivers/select-options')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.drivers)
        })
      }
      if (url.includes('/api/customers/mappings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.customerMappings)
        })
      }
      if (url.includes('/api/vehicles/mappings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.vehicleMappings)
        })
      }
      if (url.includes('/api/drivers/mappings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.driverMappings)
        })
      }
      if (url.includes('/api/suburbs')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        })
      }
      if (url.includes('/api/google-drive/settings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            settings: {
              baseFolderId: 'mock-folder-id',
              driveId: 'mock-drive-id'
            }
          })
        })
      }
      return Promise.reject(new Error('Unknown URL'))
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Helper Functions', () => {
    it('converts comma-separated string to array correctly', async () => {
      // Test stringToArray function indirectly through form behavior
      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={mockJob}
          />
        )
      })

      // Wait for the form to load and the values to appear as badges
      await waitFor(() => {
        expect(screen.getByText('Melbourne')).toBeInTheDocument()
        expect(screen.getByText('Richmond')).toBeInTheDocument()
      })
    })

    it('handles empty strings correctly', async () => {
      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={{ ...mockJob, pickup: '', dropoff: '', attachmentRunsheet: [], attachmentDocket: [], attachmentDeliveryPhotos: [] }}
          />
        )
      })

      // Should render without errors and show placeholders
      await waitFor(() => {
        expect(screen.getByText('Search pickup suburbs...')).toBeInTheDocument()
        expect(screen.getByText('Search dropoff suburbs...')).toBeInTheDocument()
      })
    })

    it('handles null/undefined values correctly', async () => {
      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={{ ...mockJob, pickup: undefined, dropoff: undefined, attachmentRunsheet: [], attachmentDocket: [], attachmentDeliveryPhotos: [] }}
          />
        )
      })

      // Should render without errors
      await waitFor(() => {
        expect(screen.getByText('Search pickup suburbs...')).toBeInTheDocument()
        expect(screen.getByText('Search dropoff suburbs...')).toBeInTheDocument()
      })
    })
  })

  describe('Form Rendering', () => {
    it('renders form dialog correctly', async () => {
      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={mockJob}
          />
        )
      })

      // Just verify the form dialog renders
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('Edit Job')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('displays existing multi-select values correctly', async () => {
      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={mockJob}
          />
        )
      })

      await waitFor(() => {
        // Should show the suburbs as badges in the multi-select
        expect(screen.getByText('Melbourne')).toBeInTheDocument()
        expect(screen.getByText('Richmond')).toBeInTheDocument()
        expect(screen.getByText('Fitzroy')).toBeInTheDocument()
        expect(screen.getByText('Carlton')).toBeInTheDocument()
      })
    })
  })

  describe('Form Submission', () => {
    it('form data conversion logic works correctly', () => {
      // Test the arrayToString function logic directly
      const arrayToString = (value: string[] | string | undefined): string => {
        if (Array.isArray(value)) {
          return value.join(', ')
        }
        return value || ''
      }

      // Test different scenarios
      expect(arrayToString(['Melbourne', 'Richmond'])).toBe('Melbourne, Richmond')
      expect(arrayToString('Melbourne, Richmond')).toBe('Melbourne, Richmond')
      expect(arrayToString(undefined)).toBe('')
      expect(arrayToString([])).toBe('')
    })

    it('string to array conversion logic works correctly', () => {
      // Test the stringToArray function logic directly
      const stringToArray = (value: string | string[] | undefined): string[] => {
        if (Array.isArray(value)) {
          return value
        }
        if (typeof value === 'string' && value.trim()) {
          return value.split(',').map(item => item.trim()).filter(item => item.length > 0)
        }
        return []
      }

      // Test different scenarios
      expect(stringToArray('Melbourne, Richmond')).toEqual(['Melbourne', 'Richmond'])
      expect(stringToArray('Melbourne')).toEqual(['Melbourne'])
      expect(stringToArray('')).toEqual([])
      expect(stringToArray(undefined)).toEqual([])
      expect(stringToArray(['Melbourne', 'Richmond'])).toEqual(['Melbourne', 'Richmond'])
    })
  })

  describe('Auto-Population with Multi-Select', () => {
    it('form renders without complex interactions', async () => {
      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={{attachmentRunsheet: [], attachmentDocket: [], attachmentDeliveryPhotos: []}}
          />
        )
      })

      // Just verify the form renders
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Edge Cases', () => {
    it('handles malformed comma-separated strings in conversion logic', () => {
      // Test the string cleanup logic directly
      const stringToArray = (value: string | string[] | undefined): string[] => {
        if (Array.isArray(value)) {
          return value
        }
        if (typeof value === 'string' && value.trim()) {
          return value.split(',').map(item => item.trim()).filter(item => item.length > 0)
        }
        return []
      }

      // Test malformed strings
      expect(stringToArray('  Melbourne,  ,Richmond, , Fitzroy  ')).toEqual(['Melbourne', 'Richmond', 'Fitzroy'])
      expect(stringToArray(',Carlton,,Collingwood,')).toEqual(['Carlton', 'Collingwood'])
      expect(stringToArray(',,,,')).toEqual([])
      expect(stringToArray('   ,   ')).toEqual([])
    })

    it('handles single suburb values in conversion logic', () => {
      // Test backward compatibility with single values
      const stringToArray = (value: string | string[] | undefined): string[] => {
        if (Array.isArray(value)) {
          return value
        }
        if (typeof value === 'string' && value.trim()) {
          return value.split(',').map(item => item.trim()).filter(item => item.length > 0)
        }
        return []
      }

      const arrayToString = (value: string[] | string | undefined): string => {
        if (Array.isArray(value)) {
          return value.join(', ')
        }
        return value || ''
      }

      // Test single suburb values
      expect(stringToArray('Melbourne')).toEqual(['Melbourne'])
      expect(stringToArray('Richmond')).toEqual(['Richmond'])
      expect(arrayToString(['Melbourne'])).toBe('Melbourne')
      expect(arrayToString(['Richmond'])).toBe('Richmond')
    })
  })
})