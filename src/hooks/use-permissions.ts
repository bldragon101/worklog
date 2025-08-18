"use client";

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { UserRole, PagePermission } from '@/lib/permissions';
import { getRolePermissionsClient } from '@/lib/permissions-client';

export function usePermissions() {
  const { user, isLoaded } = useUser();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<PagePermission[]>([]);
  const [isRoleFetching, setIsRoleFetching] = useState(false);

  useEffect(() => {
    async function fetchUserRole() {
      if (isLoaded && user) {
        setIsRoleFetching(true);
        try {
          const response = await fetch('/api/user/role');
          if (response.ok) {
            const data = await response.json();
            const role = data.role as UserRole;
            setUserRole(role);
            setPermissions(getRolePermissionsClient(role));
          } else {
            // Fallback to default user role
            setUserRole('user');
            setPermissions(getRolePermissionsClient('user'));
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          // Fallback to default user role
          setUserRole('user');
          setPermissions(getRolePermissionsClient('user'));
        } finally {
          setIsRoleFetching(false);
        }
      } else if (isLoaded) {
        setUserRole(null);
        setPermissions([]);
        setIsRoleFetching(false);
      }
    }

    fetchUserRole();
  }, [user, isLoaded]);

  const checkPermission = (permission: PagePermission): boolean => {
    return permissions?.includes(permission) ?? false;
  };

  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager' || userRole === 'admin';
  const canEdit = checkPermission('edit_jobs') || checkPermission('edit_customers') || checkPermission('edit_vehicles');
  const canDelete = checkPermission('delete_jobs') || checkPermission('delete_customers') || checkPermission('delete_vehicles');

  return {
    userRole,
    permissions,
    checkPermission,
    isAdmin,
    isManager,
    canEdit,
    canDelete,
    isLoading: !isLoaded || isRoleFetching
  };
}