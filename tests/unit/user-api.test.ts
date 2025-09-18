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
  clerkClient: jest.fn(() => ({
    users: {
      getUserList: jest.fn(),
      createUser: jest.fn()
    }
  }))
}))

jest.mock('@/lib/rate-limit', () => ({
  createRateLimiter: jest.fn(() => jest.fn(() => ({ headers: {} }))),
  rateLimitConfigs: { general: {} }
}))

// Mock zod
jest.mock('zod', () => ({
  z: {
    object: jest.fn(() => ({
      parse: jest.fn((data) => data)
    })),
    string: jest.fn(() => ({
      email: jest.fn(() => ({ optional: jest.fn() })),
      optional: jest.fn()
    })),
    enum: jest.fn(() => ({ default: jest.fn() }))
  }
}))

// Import after mocks
import { GET, POST } from '@/app/api/users/route'
import { requireAuth } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { clerkClient } from '@clerk/nextjs/server'



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
    // Clear all mocks
    (requireAuth as jest.Mock).mockClear();
    (checkPermission as jest.Mock).mockClear();
    (prisma.user.findMany as jest.Mock).mockClear();
    (prisma.user.create as jest.Mock).mockClear();
    (clerkClient as jest.Mock).mockClear();

    // Set default mocks
    (requireAuth as jest.Mock).mockResolvedValue({ userId: 'admin_123' });
    (checkPermission as jest.Mock).mockResolvedValue(true)
  })

  describe('GET /api/users', () => {
    it('returns 401 when not authenticated', async () => {
      (requireAuth as jest.Mock).mockResolvedValue(NextResponse.json({}, { status: 401 }))

      const request = new NextRequest('http://localhost:3000/api/users')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })

    it('returns 403 when permission denied', async () => {
      (checkPermission as jest.Mock).mockResolvedValue(false)

      const request = new NextRequest('http://localhost:3000/api/users')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden - User management permission required')
    })

    it('returns users list when authorized', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockUser]);
      (clerkClient as jest.Mock).mockResolvedValue({
        users: {
          getUserList: jest.fn().mockResolvedValue({ data: [] })
        }
      })

      const request = new NextRequest('http://localhost:3000/api/users')
      const response = await GET(request)
      const data = await response.json()

      if (response.status !== 200) {
        console.error('Response error:', data)
      }

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(prisma.user.findMany as jest.Mock).toHaveBeenCalled()
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
      };

      // Reset and setup fresh mocks for this test
      (clerkClient as jest.Mock).mockClear();
      (prisma.user.create as jest.Mock).mockClear();

      (clerkClient as jest.Mock).mockResolvedValue({
        users: {
          createUser: jest.fn().mockResolvedValue(mockClerkUser)
        }
      });
      (prisma.user.create as jest.Mock).mockResolvedValue({ ...mockUser, id: 'user_456' });

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
      
      const clerkError = new Error('Email already exists');
      (clerkError as Error & { errors: Array<{ message: string }> }).errors = [{ message: 'Email already exists' }];
      
      (clerkClient as jest.Mock).mockResolvedValue({
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