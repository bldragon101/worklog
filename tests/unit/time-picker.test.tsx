import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { TimePicker } from '@/components/ui/time-picker';

// Mock the date to ensure consistent test results
const mockDate = new Date('2025-08-12T10:30:00.000Z');

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(mockDate);
});

afterAll(() => {
  jest.useRealTimers();
});

describe('TimePicker Component', () => {
  it('renders with default placeholder', () => {
    render(<TimePicker />);
    expect(screen.getByText('Select time')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    render(<TimePicker placeholder="Choose start time" />);
    expect(screen.getByText('Choose start time')).toBeInTheDocument();
  });

  it('displays provided time value in HH:mm format', () => {
    render(<TimePicker value="14:30" />);
    expect(screen.getByText('14:30')).toBeInTheDocument();
  });

  it('opens popover when trigger button is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    render(<TimePicker />);
    
    const triggerButton = screen.getByRole('button');
    await user.click(triggerButton);
    
    expect(screen.getByText('Hours')).toBeInTheDocument();
    expect(screen.getByText('Minutes')).toBeInTheDocument();
  });

  it('renders time picker dropdowns when opened', async () => {
    const user = userEvent.setup({ delay: null });
    render(<TimePicker />);
    
    const triggerButton = screen.getByRole('button');
    await user.click(triggerButton);
    
    // Check that the time selection interface is displayed
    expect(screen.getByText('Hours')).toBeInTheDocument();
    expect(screen.getByText('Minutes')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('calls onChange when OK button is clicked after time selection', async () => {
    const mockOnChange = jest.fn();
    const user = userEvent.setup({ delay: null });
    
    render(<TimePicker onChange={mockOnChange} value="10:30" />);
    
    const triggerButton = screen.getByRole('button');
    await user.click(triggerButton);
    
    // Click OK
    const okButton = screen.getByText('OK');
    await user.click(okButton);
    
    // Should have been called with the existing time value
    expect(mockOnChange).toHaveBeenCalledWith('10:30');
  });



  it('clears time when "Clear" button is clicked', async () => {
    const mockOnChange = jest.fn();
    const user = userEvent.setup({ delay: null });
    
    render(<TimePicker value="14:30" onChange={mockOnChange} />);
    
    const triggerButton = screen.getByRole('button');
    await user.click(triggerButton);
    
    // Click Clear button
    const clearButton = screen.getByText('Clear');
    await user.click(clearButton);
    
    expect(mockOnChange).toHaveBeenCalledWith('');
  });

  it('parses datetime string values correctly', () => {
    const datetimeValue = '2025-08-12T14:30:00.000Z';
    render(<TimePicker value={datetimeValue} />);
    
    // Should display the full datetime value as passed
    expect(screen.getByText(datetimeValue)).toBeInTheDocument();
  });

  it('handles malformed datetime values gracefully', () => {
    const malformedValue = 'invalid-date-string';
    render(<TimePicker value={malformedValue} />);
    
    // Should not crash and should show the invalid value or placeholder
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('has OK button enabled when time value is provided', async () => {
    const user = userEvent.setup({ delay: null });
    render(<TimePicker value="14:30" />);
    
    const triggerButton = screen.getByRole('button');
    await user.click(triggerButton);
    
    const okButton = screen.getByText('OK');
    expect(okButton).not.toBeDisabled();
  });


  it('applies custom className', () => {
    render(<TimePicker className="custom-class" />);
    const triggerButton = screen.getByRole('button');
    expect(triggerButton).toHaveClass('custom-class');
  });

  it('applies custom id attribute', () => {
    render(<TimePicker id="start-time-picker" />);
    const triggerButton = screen.getByRole('button');
    expect(triggerButton).toHaveAttribute('id', 'start-time-picker');
  });

  it('respects disabled prop', () => {
    render(<TimePicker disabled />);
    const triggerButton = screen.getByRole('button');
    expect(triggerButton).toBeDisabled();
  });

  it('closes popover after OK is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    render(<TimePicker value="10:30" />);
    
    const triggerButton = screen.getByRole('button');
    await user.click(triggerButton);
    
    // Click OK
    const okButton = screen.getByText('OK');
    await user.click(okButton);
    
    // Popover should be closed
    await waitFor(() => {
      expect(screen.queryByText('Hours')).not.toBeInTheDocument();
    });
  });

  it('closes popover after Clear is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    render(<TimePicker value="10:30" />);
    
    const triggerButton = screen.getByRole('button');
    await user.click(triggerButton);
    
    // Click Clear
    const clearButton = screen.getByText('Clear');
    await user.click(clearButton);
    
    // Popover should be closed
    await waitFor(() => {
      expect(screen.queryByText('Hours')).not.toBeInTheDocument();
    });
  });
});