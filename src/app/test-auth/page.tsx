"use client";
import { useUser } from "@clerk/nextjs";
import { ProtectedLayout } from "@/components/protected-layout";

export default function TestAuthPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <ProtectedLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading...</div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-4">Authentication Test</h1>
          <p className="text-gray-600 dark:text-gray-400">
            This page is protected and only visible to authenticated users.
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">User Information</h2>
          <div className="space-y-2">
            <p><strong>User ID:</strong> {user?.id}</p>
            <p><strong>Email:</strong> {user?.emailAddresses[0]?.emailAddress}</p>
            <p><strong>First Name:</strong> {user?.firstName}</p>
            <p><strong>Last Name:</strong> {user?.lastName}</p>
            <p><strong>Created:</strong> {user?.createdAt?.toLocaleDateString()}</p>
          </div>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <p className="text-green-800 dark:text-green-200">
            ✅ Authentication is working correctly! You can access protected content.
          </p>
        </div>
      </div>
    </ProtectedLayout>
  );
} 