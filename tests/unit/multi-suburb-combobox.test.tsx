import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MultiSuburbCombobox } from '@/components/shared/multi-suburb-combobox'

// Mock fetch for API calls
global.fetch = jest.fn()

const mockSuburbs = [
  {
    value: 'melbourne-vic-3000',
    label: 'Melbourne, VIC 3000',
    postcode: 3000,
    name: 'Melbourne'
  },
  {
    value: 'richmond-vic-3121',
    label: 'Richmond, VIC 3121',
    postcode: 3121,
    name: 'Richmond'
  },
  {
    value: 'fitzroy-vic-3065',
    label: 'Fitzroy, VIC 3065',
    postcode: 3065,
    name: 'Fitzroy'
  }
]

describe('MultiSuburbCombobox', () => {
  const mockOnChange = jest.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
    ;(fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuburbs)
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders with placeholder when no values selected', () => {
    render(
      <MultiSuburbCombobox
        values={[]}
        onChange={mockOnChange}
        placeholder="Select suburbs..."
      />
    )

    expect(screen.getByText('Select suburbs...')).toBeInTheDocument()
  })

  it('displays selected values as badges when few selections', () => {
    render(
      <MultiSuburbCombobox
        values={['Melbourne', 'Richmond']}
        onChange={mockOnChange}
        placeholder="Select suburbs..."
      />
    )

    expect(screen.getByText('Melbourne')).toBeInTheDocument()
    expect(screen.getByText('Richmond')).toBeInTheDocument()
  })

  it('displays count when single value selected', () => {
    render(
      <MultiSuburbCombobox
        values={['Melbourne']}
        onChange={mockOnChange}
        placeholder="Select suburbs..."
      />
    )

    expect(screen.getByText('Melbourne')).toBeInTheDocument()
  })

  it('displays count when multiple values selected', () => {
    render(
      <MultiSuburbCombobox
        values={['Melbourne', 'Richmond', 'Fitzroy', 'Carlton']}
        onChange={mockOnChange}
        placeholder="Select suburbs..."
      />
    )

    expect(screen.getByText('4 suburbs selected')).toBeInTheDocument()
  })

  it('opens dropdown when clicked', async () => {
    render(
      <MultiSuburbCombobox
        values={[]}
        onChange={mockOnChange}
        placeholder="Select suburbs..."
      />
    )

    const button = screen.getByRole('combobox')
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Select suburbs...')).toBeInTheDocument()
    })
  })

  it('searches for suburbs when typing', async () => {
    render(
      <MultiSuburbCombobox
        values={[]}
        onChange={mockOnChange}
        placeholder="Select suburbs..."
      />
    )

    const button = screen.getByRole('combobox')
    fireEvent.click(button)

    const searchInput = screen.getByPlaceholderText('Select suburbs...')
    fireEvent.change(searchInput, { target: { value: 'melbourne' } })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/suburbs?q=melbourne')
    })
  })

  it('adds suburb when selected from dropdown', async () => {
    render(
      <MultiSuburbCombobox
        values={[]}
        onChange={mockOnChange}
        placeholder="Select suburbs..."
      />
    )

    const button = screen.getByRole('combobox')
    fireEvent.click(button)

    const searchInput = screen.getByPlaceholderText('Select suburbs...')
    fireEvent.change(searchInput, { target: { value: 'mel' } })

    await waitFor(() => {
      const melbourneOption = screen.getByText('Melbourne, VIC 3000')
      fireEvent.click(melbourneOption)
    })

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(['Melbourne'])
    })
  })

  it('removes suburb when already selected', async () => {
    render(
      <MultiSuburbCombobox
        values={['Melbourne']}
        onChange={mockOnChange}
        placeholder="Select suburbs..."
      />
    )

    const button = screen.getByRole('combobox')
    fireEvent.click(button)

    const searchInput = screen.getByPlaceholderText('Select suburbs...')
    fireEvent.change(searchInput, { target: { value: 'mel' } })

    await waitFor(() => {
      const melbourneOption = screen.getByText('Melbourne, VIC 3000')
      fireEvent.click(melbourneOption)
    })

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith([])
    })
  })

  it('removes value when X button is clicked', async () => {
    render(
      <MultiSuburbCombobox
        values={['Melbourne', 'Richmond']}
        onChange={mockOnChange}
        placeholder="Select suburbs..."
      />
    )

    const removeButtons = screen.getAllByRole('button')
    const xButton = removeButtons.find(button => 
      button.querySelector('svg') && button !== screen.getByRole('combobox')
    )

    if (xButton) {
      fireEvent.click(xButton)
    }

    expect(mockOnChange).toHaveBeenCalled()
  })

  it('respects maxSelections limit', async () => {
    render(
      <MultiSuburbCombobox
        values={['Melbourne', 'Richmond']}
        onChange={mockOnChange}
        placeholder="Select suburbs..."
        maxSelections={2}
      />
    )

    const button = screen.getByRole('combobox')
    fireEvent.click(button)

    const searchInput = screen.getByPlaceholderText('Select suburbs...')
    fireEvent.change(searchInput, { target: { value: 'fitz' } })

    // Wait for the search to complete and Fitzroy option to appear
    await waitFor(() => {
      expect(screen.getByText('Fitzroy, VIC 3065')).toBeInTheDocument()
    })

    const fitzroyOption = screen.getByText('Fitzroy, VIC 3065')
    fireEvent.click(fitzroyOption)

    // Should not call onChange since limit is reached (2/2)
    await waitFor(() => {
      expect(mockOnChange).not.toHaveBeenCalled()
    })
  })

  it('adds custom suburb when Enter is pressed', async () => {
    render(
      <MultiSuburbCombobox
        values={[]}
        onChange={mockOnChange}
        placeholder="Select suburbs..."
      />
    )

    const button = screen.getByRole('combobox')
    fireEvent.click(button)

    const searchInput = screen.getByPlaceholderText('Select suburbs...')
    fireEvent.change(searchInput, { target: { value: 'Custom Location' } })
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(['Custom Location'])
    })
  })

  it('handles disabled state', () => {
    render(
      <MultiSuburbCombobox
        values={['Melbourne']}
        onChange={mockOnChange}
        placeholder="Select suburbs..."
        disabled={true}
      />
    )

    const button = screen.getByRole('combobox')
    expect(button).toBeDisabled()
  })

  it('handles loading state', () => {
    render(
      <MultiSuburbCombobox
        values={[]}
        onChange={mockOnChange}
        placeholder="Select suburbs..."
        loading={true}
      />
    )

    const button = screen.getByRole('combobox')
    expect(button).toBeDisabled()
  })

  it('shows search message when query is too short', async () => {
    render(
      <MultiSuburbCombobox
        values={[]}
        onChange={mockOnChange}
        placeholder="Select suburbs..."
      />
    )

    const button = screen.getByRole('combobox')
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('Type at least 2 characters to search suburbs.')).toBeInTheDocument()
    })
  })
})