"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Shield, User, Eye, Settings, Trash2 } from "lucide-react";
import { formatDistance } from 'date-fns';

interface UserCardProps {
  user: {
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
  };
  onRoleChange?: (userId: string, newRole: string) => void;
  onToggleActive?: (userId: string, isActive: boolean) => void;
  onDelete?: (userId: string) => void;
}

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'admin': return Shield;
    case 'manager': return Settings;
    case 'viewer': return Eye;
    default: return User;
  }
};

const getRoleColor = (role: string) => {
  switch (role) {
    case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
    case 'manager': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    case 'viewer': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
  }
};

export function UserCard({ user, onRoleChange, onToggleActive, onDelete }: UserCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const RoleIcon = getRoleIcon(user.role);
  
  const displayName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}`
    : user.firstName || user.lastName || 'Unknown User';

  const getInitials = () => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email[0]?.toUpperCase() || '?';
  };

  const lastActiveDate = user.lastSignIn || user.lastLogin;

  const handleRoleChange = async (newRole: string) => {
    if (!onRoleChange || isLoading) return;
    setIsLoading(true);
    try {
      await onRoleChange(user.id, newRole);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async () => {
    if (!onToggleActive || isLoading) return;
    setIsLoading(true);
    try {
      await onToggleActive(user.id, !user.isActive);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || isLoading) return;
    if (window.confirm(`Are you sure you want to delete ${displayName}? This action cannot be undone.`)) {
      setIsLoading(true);
      try {
        await onDelete(user.id);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Card className={`transition-all hover:shadow-lg ${!user.isActive ? 'opacity-60' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.imageUrl || undefined} alt={displayName} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-sm">{displayName}</h3>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={isLoading}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>User Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => handleRoleChange('admin')}>
                <Shield className="mr-2 h-4 w-4 text-red-500" />
                Make Admin
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleRoleChange('manager')}>
                <Settings className="mr-2 h-4 w-4 text-blue-500" />
                Make Manager
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleRoleChange('user')}>
                <User className="mr-2 h-4 w-4 text-gray-500" />
                Make User
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleRoleChange('viewer')}>
                <Eye className="mr-2 h-4 w-4 text-yellow-500" />
                Make Viewer
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleToggleActive}>
              {user.isActive ? 'Deactivate' : 'Activate'} User
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <Badge className={`${getRoleColor(user.role)} flex items-center gap-1`}>
            <RoleIcon className="h-3 w-3" />
            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </Badge>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {lastActiveDate 
                ? `Active ${formatDistance(new Date(lastActiveDate), new Date(), { addSuffix: true })}`
                : 'Never signed in'
              }
            </p>
            <p className="text-xs text-muted-foreground">
              Joined {formatDistance(new Date(user.createdAt), new Date(), { addSuffix: true })}
            </p>
          </div>
        </div>
        {!user.isActive && (
          <Badge variant="secondary" className="mt-2 bg-gray-100 text-gray-600">
            Inactive
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}