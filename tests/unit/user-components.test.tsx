import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { UserCard } from '@/components/users/user-card'

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistance: jest.fn(() => '2 days ago')
}))

// Mock toast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
    toasts: []
  })
}))

const mockUser = {
  id: 'user_123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  imageUrl: 'https://example.com/avatar.jpg',
  role: 'user',
  isActive: true,
  lastLogin: new Date('2023-01-01'),
  createdAt: new Date('2022-12-01')
}

describe('UserCard Component', () => {
  const defaultProps = {
    user: mockUser,
    onRoleChange: jest.fn(),
    onToggleActive: jest.fn(),
    onDelete: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders user information correctly', () => {
    render(<UserCard {...defaultProps} />)

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
  })

  it('handles missing names gracefully', () => {
    const userWithoutName = {
      ...mockUser,
      firstName: null,
      lastName: null
    }

    render(<UserCard {...defaultProps} user={userWithoutName} />)
    expect(screen.getByText('Unknown User')).toBeInTheDocument()
  })

  it('shows correct role badges', () => {
    const adminUser = { ...mockUser, role: 'admin' }
    
    render(<UserCard {...defaultProps} user={adminUser} />)
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('shows inactive badge for inactive users', () => {
    const inactiveUser = { ...mockUser, isActive: false }
    
    render(<UserCard {...defaultProps} user={inactiveUser} />)
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('generates correct initials for user avatar', () => {
    render(<UserCard {...defaultProps} />)
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('falls back to email initial when no name provided', () => {
    const userWithoutName = {
      ...mockUser,
      firstName: null,
      lastName: null
    }

    render(<UserCard {...defaultProps} user={userWithoutName} />)
    expect(screen.getByText('T')).toBeInTheDocument() // First letter of email
  })
})