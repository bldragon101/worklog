import '@testing-library/jest-dom'

// Mock Clerk
jest.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    user: {
      id: 'user_test123',
      firstName: 'Test',
      lastName: 'User',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
    },
    isLoaded: true,
    isSignedIn: true,
  }),
  SignedIn: ({ children }) => children,
  SignedOut: () => null,
  UserButton: () => <div data-testid="user-button">User Button</div>,
  ClerkProvider: ({ children }) => children,
  auth: () => ({ userId: 'user_test123' }),
}))

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock environment variables
process.env.NODE_ENV = 'test'

// Mock ResizeObserver for cmdk library
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock scrollIntoView for cmdk library
Element.prototype.scrollIntoView = jest.fn();