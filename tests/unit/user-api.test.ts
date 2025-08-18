/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server'

// Apply mocks
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn()
}))

jest.mock('@/lib/permissions', () => ({
  checkPermission: jest.fn()
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
  }
}))

jest.mock('@clerk/nextjs/server', () => ({
  clerkClient: jest.fn()
}))

jest.mock('@/lib/rate-limit', () => ({
  createRateLimiter: jest.fn(() => jest.fn(() => ({ headers: {} }))),
  rateLimitConfigs: { general: {} }
}))

// Mock validation
jest.mock('@/lib/validation', () => ({
  createUserSchema: {
    parse: jest.fn((data) => data)
  }
}))

// Import after mocks
import { GET, POST } from '@/app/api/users/route'

const { requireAuth } = require('@/lib/auth')
const { checkPermission } = require('@/lib/permissions')
const { prisma } = require('@/lib/prisma')
const { clerkClient } = require('@clerk/nextjs/server')

const mockUser = {
  id: 'user_123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'user',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
}

describe('Users API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    requireAuth.mockResolvedValue({ userId: 'admin_123' })
    checkPermission.mockResolvedValue(true)
  })

  describe('GET /api/users', () => {
    it('returns 401 when not authenticated', async () => {
      requireAuth.mockResolvedValue(NextResponse.json({}, { status: 401 }))

      const request = new NextRequest('http://localhost:3000/api/users')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })

    it('returns 403 when permission denied', async () => {
      checkPermission.mockResolvedValue(false)

      const request = new NextRequest('http://localhost:3000/api/users')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden - User management permission required')
    })

    it('returns users list when authorized', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser])
      clerkClient.mockResolvedValue({
        users: {
          getUserList: jest.fn().mockResolvedValue({ data: [] })
        }
      })

      const request = new NextRequest('http://localhost:3000/api/users')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(prisma.user.findMany).toHaveBeenCalled()
    })
  })

  describe('POST /api/users', () => {
    const validUserData = {
      email: 'newuser@example.com',
      firstName: 'New',
      lastName: 'User',
      role: 'user',
      sendInvitation: true
    }

    it('creates user successfully', async () => {
      const mockClerkUser = {
        id: 'user_456',
        imageUrl: 'https://example.com/avatar.jpg'
      }
      
      clerkClient.mockResolvedValue({
        users: {
          createUser: jest.fn().mockResolvedValue(mockClerkUser)
        }
      })
      prisma.user.create.mockResolvedValue({ ...mockUser, id: 'user_456' })

      const request = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify(validUserData),
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.user).toBeDefined()
      expect(data.message).toContain('User created successfully')
    })

    it('handles Clerk errors gracefully', async () => {
      // Mock console.error to prevent test output noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      const clerkError = new Error('Email already exists')
      clerkError.errors = [{ message: 'Email already exists' }]
      
      clerkClient.mockResolvedValue({
        users: {
          createUser: jest.fn().mockRejectedValue(clerkError)
        }
      })

      const request = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify(validUserData),
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Failed to create user in Clerk')
      
      // Restore console.error
      consoleSpy.mockRestore()
    })
  })
})