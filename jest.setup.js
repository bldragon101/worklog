import '@testing-library/jest-dom'

// Set test environment
process.env.NODE_ENV = 'test'

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

// Essential global mocks
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

global.Element = global.Element || {}
if (global.Element && global.Element.prototype) {
  global.Element.prototype.scrollIntoView = jest.fn()
}