"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/brand/icon-logo";
import { UserCard } from "@/components/users/user-card";
import { CreateUserDialog } from "@/components/users/create-user-dialog";
import {
  Users,
  RefreshCw,
  Shield,
  User,
  Eye,
  Settings,
  UserPlus2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  role: string;
  isActive: boolean;
  lastLogin?: Date | null;
  lastSignIn?: Date | null;
  createdAt: Date;
}

export default function SettingsUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/users");

      if (!response.ok) {
        let errorMessage = "Failed to fetch users";

        // Handle specific HTTP status codes
        switch (response.status) {
          case 401:
            errorMessage =
              "You are not authorized to view users. Please sign in again.";
            break;
          case 403:
            errorMessage = "You do not have permission to manage users.";
            break;
          case 429:
            errorMessage =
              "Too many requests. Please wait a moment and try again.";
            break;
          case 500:
            errorMessage = "Server error occurred. Please try again later.";
            break;
          default:
            // Try to get error message from response
            try {
              const errorData = await response.json();
              errorMessage = errorData.error || errorMessage;
            } catch {
              // Use default message if JSON parsing fails
            }
        }

        throw new Error(errorMessage);
      }

      const userData = await response.json();

      // Validate response data
      if (!Array.isArray(userData)) {
        throw new Error("Invalid response format from server");
      }

      // Convert date strings to Date objects
      const processedUsers = userData.map(
        (
          user: User & {
            createdAt: string;
            lastLogin?: string;
            lastSignIn?: string;
          },
        ) => ({
          ...user,
          createdAt: new Date(user.createdAt),
          lastLogin: user.lastLogin ? new Date(user.lastLogin) : null,
          lastSignIn: user.lastSignIn ? new Date(user.lastSignIn) : null,
        }),
      );

      setUsers(processedUsers);
      setFilteredUsers(processedUsers);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch users";

      toast({
        title: "Error Loading Users",
        description: errorMessage,
        variant: "destructive",
      });

      // Set empty arrays on error to prevent UI issues
      setUsers([]);
      setFilteredUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    let filtered = users;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (user) =>
          user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          `${user.firstName || ""} ${user.lastName || ""}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
      );
    }

    // Filter by role
    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    // Filter by status
    if (statusFilter === "active") {
      filtered = filtered.filter((user) => user.isActive);
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter((user) => !user.isActive);
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery, roleFilter, statusFilter]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to update user role";

        switch (response.status) {
          case 401:
            errorMessage = "You are not authorized to update user roles.";
            break;
          case 403:
            errorMessage = "You do not have permission to modify user roles.";
            break;
          case 404:
            errorMessage = "User not found.";
            break;
          case 409:
            errorMessage =
              "Cannot update role due to conflict. User may have been modified by someone else.";
            break;
          default:
            try {
              const errorData = await response.json();
              errorMessage = errorData.error || errorMessage;
            } catch {
              // Use default message if JSON parsing fails
            }
        }

        throw new Error(errorMessage);
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, role: newRole } : user,
        ),
      );

      toast({
        title: "Success",
        description: "User role updated successfully",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update user role";

      toast({
        title: "Role Update Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        throw new Error("Failed to update user status");
      }

      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, isActive } : user)),
      );

      toast({
        title: "Success",
        description: `User ${isActive ? "activated" : "deactivated"} successfully`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update user status";

      toast({
        title: "Status Update Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete user");
      }

      setUsers((prev) => prev.filter((user) => user.id !== userId));

      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete user";

      toast({
        title: "Delete Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleSyncUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/sync-users", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to sync users");
      }

      const result = await response.json();

      toast({
        title: "Success",
        description: `Synced ${result.syncedCount} users from Clerk`,
      });

      // Refresh the user list
      await fetchUsers();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to sync users from Clerk";

      toast({
        title: "Sync Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleStats = () => {
    const stats = {
      admin: users.filter((u) => u.role === "admin").length,
      manager: users.filter((u) => u.role === "manager").length,
      user: users.filter((u) => u.role === "user").length,
      viewer: users.filter((u) => u.role === "viewer").length,
      active: users.filter((u) => u.isActive).length,
      inactive: users.filter((u) => !u.isActive).length,
    };
    return stats;
  };

  const stats = getRoleStats();

  return (
    <ProtectedLayout>
      <ProtectedRoute
        requiredPermission="manage_users"
        fallbackTitle="User Management Access Required"
        fallbackDescription="You need user management permission to access this page. Only administrators can manage users."
      >
        <div className="flex flex-col h-full space-y-6 p-6">
          <PageHeader pageType="users" />

          <div className="flex flex-col space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  User Management
                </h1>
                <p className="text-muted-foreground">
                  Manage users, roles, and permissions for your organization
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  id="refresh-users-btn"
                  variant="outline"
                  size="sm"
                  onClick={fetchUsers}
                  disabled={isLoading}
                  className="h-8"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                </Button>
                <Button
                  id="sync-users-btn"
                  variant="outline"
                  size="sm"
                  onClick={handleSyncUsers}
                  disabled={isLoading}
                  className="h-8"
                >
                  <UserPlus2 className="h-4 w-4 mr-2" />
                  Sync from Clerk
                </Button>
                <CreateUserDialog onUserCreated={fetchUsers} />
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <Card>
                <CardContent className="flex items-center p-4">
                  <Users className="h-8 w-8 text-blue-500" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Total
                    </p>
                    <p className="text-2xl font-bold">{users.length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center p-4">
                  <Shield className="h-8 w-8 text-red-500" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Admins
                    </p>
                    <p className="text-2xl font-bold">{stats.admin}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center p-4">
                  <Settings className="h-8 w-8 text-blue-500" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Managers
                    </p>
                    <p className="text-2xl font-bold">{stats.manager}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center p-4">
                  <User className="h-8 w-8 text-gray-500" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Users
                    </p>
                    <p className="text-2xl font-bold">{stats.user}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center p-4">
                  <Eye className="h-8 w-8 text-yellow-500" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Viewers
                    </p>
                    <p className="text-2xl font-bold">{stats.viewer}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center p-4">
                  <div
                    className={`h-8 w-8 rounded ${stats.active > 0 ? "bg-green-500" : "bg-gray-400"}`}
                  />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Active
                    </p>
                    <p className="text-2xl font-bold">{stats.active}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      id="search-users-input"
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge
                      variant={roleFilter === "all" ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setRoleFilter("all")}
                    >
                      All Roles
                    </Badge>
                    <Badge
                      variant={roleFilter === "admin" ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setRoleFilter("admin")}
                    >
                      Admin
                    </Badge>
                    <Badge
                      variant={roleFilter === "manager" ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setRoleFilter("manager")}
                    >
                      Manager
                    </Badge>
                    <Badge
                      variant={roleFilter === "user" ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setRoleFilter("user")}
                    >
                      User
                    </Badge>
                    <Badge
                      variant={roleFilter === "viewer" ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setRoleFilter("viewer")}
                    >
                      Viewer
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Badge
                      variant={statusFilter === "all" ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setStatusFilter("all")}
                    >
                      All Status
                    </Badge>
                    <Badge
                      variant={
                        statusFilter === "active" ? "default" : "outline"
                      }
                      className="cursor-pointer"
                      onClick={() => setStatusFilter("active")}
                    >
                      Active
                    </Badge>
                    <Badge
                      variant={
                        statusFilter === "inactive" ? "default" : "outline"
                      }
                      className="cursor-pointer"
                      onClick={() => setStatusFilter("inactive")}
                    >
                      Inactive
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Users Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredUsers.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onRoleChange={handleRoleChange}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDeleteUser}
                  />
                ))}
              </div>
            )}

            {!isLoading && filteredUsers.length === 0 && (
              <Card className="p-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No users found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || roleFilter !== "all" || statusFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Get started by creating your first user"}
                </p>
              </Card>
            )}
          </div>
        </div>
      </ProtectedRoute>
    </ProtectedLayout>
  );
}
