import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { JobForm } from '@/components/entities/job/job-form'
import { Job } from '@/lib/types'

// Mock fetch for API calls
global.fetch = jest.fn()

const mockJob: Partial<Job> = {
  id: 1,
  date: '2024-01-15',
  driver: 'John Doe',
  customer: 'ABC Company',
  pickup: 'Melbourne, Richmond',
  dropoff: 'Fitzroy, Carlton',
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
            job={{ ...mockJob, pickup: '', dropoff: '' }}
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
            job={{ ...mockJob, pickup: undefined, dropoff: undefined }}
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
    it('renders pickup and dropoff multi-select fields', async () => {
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
        expect(screen.getByLabelText('Pick up')).toBeInTheDocument()
        expect(screen.getByLabelText('Drop off')).toBeInTheDocument()
      })
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
    it('converts array values back to comma-separated strings on save', async () => {
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
        const saveButton = screen.getByText('Save')
        expect(saveButton).toBeInTheDocument()
      })

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            pickup: 'Melbourne, Richmond',
            dropoff: 'Fitzroy, Carlton'
          })
        )
      })
    })

    it('handles empty multi-select values correctly', async () => {
      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={{ ...mockJob, pickup: '', dropoff: '' }}
          />
        )
      })

      await waitFor(() => {
        const saveButton = screen.getByText('Save')
        expect(saveButton).toBeInTheDocument()
      })

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            pickup: '',
            dropoff: ''
          })
        )
      })
    })
  })

  describe('Auto-Population with Multi-Select', () => {
    it('maintains multi-select functionality when auto-population occurs', async () => {
      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={{}}
          />
        )
      })

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByLabelText('Driver')).toBeInTheDocument()
      })

      // Select a driver - this should trigger auto-population
      const driverSelect = screen.getByLabelText('Driver')
      fireEvent.click(driverSelect)

      // The multi-select fields should still work after auto-population
      const pickupField = screen.getByLabelText('Pick up')
      const dropoffField = screen.getByLabelText('Drop off')
      
      expect(pickupField).toBeInTheDocument()
      expect(dropoffField).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles malformed comma-separated strings', async () => {
      const malformedJob = {
        ...mockJob,
        pickup: '  Melbourne,  ,Richmond, , Fitzroy  ',
        dropoff: ',Carlton,,Collingwood,'
      }

      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={malformedJob}
          />
        )
      })

      // Should clean up and display only valid suburbs
      await waitFor(() => {
        expect(screen.getByText('Melbourne')).toBeInTheDocument()
        expect(screen.getByText('Richmond')).toBeInTheDocument()
        expect(screen.getByText('Fitzroy')).toBeInTheDocument()
        expect(screen.getByText('Carlton')).toBeInTheDocument()
        expect(screen.getByText('Collingwood')).toBeInTheDocument()
      })
    })

    it('handles single suburb values (backward compatibility)', async () => {
      const singleSuburbJob = {
        ...mockJob,
        pickup: 'Melbourne',
        dropoff: 'Richmond'
      }

      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={singleSuburbJob}
          />
        )
      })

      // Should display single values correctly
      await waitFor(() => {
        expect(screen.getByText('Melbourne')).toBeInTheDocument()
        expect(screen.getByText('Richmond')).toBeInTheDocument()
      })
    })
  })
})