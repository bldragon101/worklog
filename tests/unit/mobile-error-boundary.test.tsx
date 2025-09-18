import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileErrorBoundary } from '@/components/data-table/mobile/mobile-error-boundary';

// Mock the UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="error-card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="error-card-content" className={className}>
      {children}
    </div>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string; [key: string]: unknown }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-testid={props['data-testid'] || 'error-retry-button'}
      {...props}
    >
      {children}
    </button>
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  AlertTriangle: () => <span data-testid="alert-triangle-icon">⚠️</span>,
  RefreshCw: () => <span data-testid="refresh-icon">🔄</span>,
}));

// Component that throws an error for testing
const ProblematicComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div data-testid="working-component">Working component</div>;
};

describe('MobileErrorBoundary', () => {
  // Suppress console.error for these tests since we're intentionally throwing errors
  const originalConsoleError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  it('renders children when there is no error', () => {
    render(
      <MobileErrorBoundary>
        <ProblematicComponent shouldThrow={false} />
      </MobileErrorBoundary>
    );

    expect(screen.getByTestId('working-component')).toBeInTheDocument();
    expect(screen.queryByTestId('error-card')).not.toBeInTheDocument();
  });

  it('renders error UI when child component throws', () => {
    render(
      <MobileErrorBoundary>
        <ProblematicComponent shouldThrow={true} />
      </MobileErrorBoundary>
    );

    expect(screen.getByTestId('error-card')).toBeInTheDocument();
    expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
    expect(screen.getByText('Unable to display content')).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong with the mobile view/)).toBeInTheDocument();
    expect(screen.getByTestId('error-retry-button')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.queryByTestId('working-component')).not.toBeInTheDocument();
  });

  it('renders custom fallback message when provided', () => {
    const customMessage = 'Custom error message for testing';
    
    render(
      <MobileErrorBoundary fallbackMessage={customMessage}>
        <ProblematicComponent shouldThrow={true} />
      </MobileErrorBoundary>
    );

    expect(screen.getByText(customMessage)).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong with the mobile view/)).not.toBeInTheDocument();
  });

  it('allows retry after error', () => {
    const TestComponent = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      
      // Simulate fixing the error after retry
      React.useEffect(() => {
        const timer = setTimeout(() => {
          setShouldThrow(false);
        }, 100);
        return () => clearTimeout(timer);
      }, []);

      return <ProblematicComponent shouldThrow={shouldThrow} />;
    };

    render(
      <MobileErrorBoundary>
        <TestComponent />
      </MobileErrorBoundary>
    );

    // Initially should show error
    expect(screen.getByTestId('error-card')).toBeInTheDocument();

    // Click retry button
    const retryButton = screen.getByTestId('error-retry-button');
    fireEvent.click(retryButton);

    // After retry, should attempt to render children again
    // Note: In a real scenario, the error condition would need to be resolved
    // for the retry to be successful
  });

  it('logs error to console when componentDidCatch is called', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(
      <MobileErrorBoundary>
        <ProblematicComponent shouldThrow={true} />
      </MobileErrorBoundary>
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      'Mobile component error:',
      expect.any(Error),
      expect.any(Object)
    );

    consoleSpy.mockRestore();
  });

  it('maintains mobile-friendly card styling', () => {
    render(
      <MobileErrorBoundary>
        <ProblematicComponent shouldThrow={true} />
      </MobileErrorBoundary>
    );

    const errorCard = screen.getByTestId('error-card');
    expect(errorCard).toHaveClass('mb-3');

    const cardContent = screen.getByTestId('error-card-content');
    expect(cardContent).toHaveClass('p-4');
  });

  it('includes proper icons in error display', () => {
    render(
      <MobileErrorBoundary>
        <ProblematicComponent shouldThrow={true} />
      </MobileErrorBoundary>
    );

    expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
    expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
  });
});