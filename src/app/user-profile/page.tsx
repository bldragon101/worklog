"use client";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { ProtectedLayout } from "@/components/protected-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Mail, User, Shield, Settings } from "lucide-react";
import { AccountDialog } from "@/components/account-dialog";
import { Button } from "@/components/ui/button";

export default function UserProfilePage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <ProtectedLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading profile...</div>
        </div>
      </ProtectedLayout>
    );
  }

  if (!user) {
    return (
      <ProtectedLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">User not found</div>
        </div>
      </ProtectedLayout>
    );
  }

  const userInitials = user.firstName && user.lastName 
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user.emailAddresses[0]?.emailAddress?.[0]?.toUpperCase() || "U";

  const userName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}`
    : user.emailAddresses[0]?.emailAddress || "User";

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Image src="/logo.svg" alt="WorkLog Logo" width={32} height={32} className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">User Profile</h1>
            <p className="text-muted-foreground">Manage your personal information</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Personal Information</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Your basic profile information
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={user.imageUrl} alt={userName} />
                  <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{userName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {user.emailAddresses[0]?.emailAddress}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4" />
                  <span className="font-medium">Email:</span>
                  <span>{user.emailAddresses[0]?.emailAddress || "Not provided"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Member since:</span>
                  <span>{user.createdAt?.toLocaleDateString() || "Unknown"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Account Status</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Your account verification status
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Email Verification</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    user.emailAddresses[0]?.verification?.status === "verified" 
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                  }`}>
                    {user.emailAddresses[0]?.verification?.status === "verified" ? "Verified" : "Pending"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Account Status</span>
                  <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Last Sign In</span>
                  <span className="text-sm text-muted-foreground">
                    {user.lastSignInAt?.toLocaleDateString() || "Unknown"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-2">Account Actions</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Manage your account settings and preferences
          </p>
          <div className="flex flex-wrap gap-2">
            <AccountDialog>
              <Button variant="outline" className="inline-flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Account Settings
              </Button>
            </AccountDialog>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
} 