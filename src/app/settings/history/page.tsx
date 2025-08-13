"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PageHeader } from "@/components/brand/icon-logo";
import { CalendarIcon, Search, RefreshCw, History, User, Table, Activity, ChevronDown, Database } from "lucide-react";
import { format, parseISO } from 'date-fns';

interface ActivityLog {
  id: number;
  userId: string;
  userEmail: string | null;
  action: string;
  tableName: string;
  recordId: string;
  description: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}

interface ActivityLogResponse {
  logs: ActivityLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    tableName: '',
    action: '',
    startDate: '',
    endDate: ''
  });

  // Fetch activity logs
  const fetchLogs = useCallback(async (page = 1) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      });

      // Apply filters
      if (filters.tableName) params.set('tableName', filters.tableName);
      if (filters.action) params.set('action', filters.action);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);

      const response = await fetch(`/api/activity-logs?${params}`);
      if (response.ok) {
        const data: ActivityLogResponse = await response.json();
        setLogs(data.logs);
        setPagination(data.pagination);
      } else {
        console.error('Failed to fetch activity logs');
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination.limit]);

  useEffect(() => {
    fetchLogs(1);
  }, [filters, fetchLogs]);

  // Filter logs by search term on client side
  const filteredLogs = logs.filter(log => 
    !filters.search || 
    log.description.toLowerCase().includes(filters.search.toLowerCase()) ||
    log.userEmail?.toLowerCase().includes(filters.search.toLowerCase()) ||
    log.tableName.toLowerCase().includes(filters.search.toLowerCase())
  );

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'UPDATE': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'DELETE': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getTableIcon = (tableName: string) => {
    switch (tableName) {
      case 'Jobs': return '🚛';
      case 'Customer': return '🏢';
      case 'Driver': return '👤';
      case 'Vehicle': return '🚐';
      default: return '📝';
    }
  };

  const formatFieldValue = (value: unknown, fieldName?: string): string => {
    if (value === null || value === undefined) return 'empty';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') {
      // Check if it's a date string
      const date = new Date(value);
      if (!isNaN(date.getTime()) && value.includes('T')) {
        // For time fields, show only the time in HH:MM format
        if (fieldName === 'startTime' || fieldName === 'finishTime') {
          return date.toLocaleTimeString('en-GB', {timeZone: 'Australia/Melbourne', hour12: false}).slice(0, 5);
        }
        // For other date fields, show the date
        return date.toLocaleDateString();
      }
      return value;
    }
    return String(value);
  };

  const getFieldDisplayName = (fieldName: string): string => {
    const fieldMap: Record<string, string> = {
      'billTo': 'Bill To',
      'truckType': 'Truck Type',
      'chargedHours': 'Charged Hours',
      'driverCharge': 'Driver Charge',
      'fuelLevy': 'Fuel Levy',
      'breakDeduction': 'Break Deduction',
      'semiCrane': 'Semi Crane',
      'yearOfManufacture': 'Year of Manufacture',
      'carryingCapacity': 'Carrying Capacity',
      'trayLength': 'Tray Length',
      'craneReach': 'Crane Reach',
      'craneType': 'Crane Type',
      'craneCapacity': 'Crane Capacity',
      'expiryDate': 'Expiry Date'
    };
    
    return fieldMap[fieldName] || fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  };

  const renderDataChanges = (log: ActivityLog) => {
    if (log.action === 'CREATE' && log.newData) {
      return (
        <div className="space-y-2">
          <div className="font-medium text-sm text-green-700 dark:text-green-300">Created Data:</div>
          {Object.entries(log.newData)
            .filter(([key]) => !['id', 'createdAt', 'updatedAt'].includes(key))
            .map(([key, value]) => (
              <div key={key} className="flex justify-between items-center py-1 px-2 bg-green-50 dark:bg-green-900/20 rounded">
                <span className="text-sm font-medium">{getFieldDisplayName(key)}:</span>
                <span className="text-sm">{formatFieldValue(value, key)}</span>
              </div>
            ))}
        </div>
      );
    }
    
    if (log.action === 'DELETE' && log.oldData) {
      return (
        <div className="space-y-2">
          <div className="font-medium text-sm text-red-700 dark:text-red-300">Deleted Data:</div>
          {Object.entries(log.oldData)
            .filter(([key]) => !['id', 'createdAt', 'updatedAt'].includes(key))
            .map(([key, value]) => (
              <div key={key} className="flex justify-between items-center py-1 px-2 bg-red-50 dark:bg-red-900/20 rounded">
                <span className="text-sm font-medium">{getFieldDisplayName(key)}:</span>
                <span className="text-sm">{formatFieldValue(value, key)}</span>
              </div>
            ))}
        </div>
      );
    }
    
    if (log.action === 'UPDATE' && log.oldData && log.newData) {
      const changes = Object.entries(log.newData)
        .filter(([key]) => !['id', 'createdAt', 'updatedAt'].includes(key))
        .filter(([key, newValue]) => {
          const oldValue = log.oldData?.[key];
          return JSON.stringify(oldValue) !== JSON.stringify(newValue);
        });
        
      if (changes.length === 0) {
        return <div className="text-sm text-muted-foreground">No field changes detected</div>;
      }
      
      return (
        <div className="space-y-2">
          <div className="font-medium text-sm text-blue-700 dark:text-blue-300">Field Changes:</div>
          {changes.map(([key, newValue]) => {
            const oldValue = log.oldData?.[key];
            return (
              <div key={key} className="py-2 px-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                <div className="font-medium text-sm">{getFieldDisplayName(key)}</div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="text-sm">
                    <span className="text-red-600 dark:text-red-400">From:</span> {formatFieldValue(oldValue, key)}
                  </div>
                  <div className="text-sm">
                    <span className="text-green-600 dark:text-green-400">To:</span> {formatFieldValue(newValue, key)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    
    return null;
  };

  return (
    <ProtectedLayout>
      <ProtectedRoute 
        requiredPermission="view_history"
        fallbackTitle="History Access Required"
        fallbackDescription="You need admin access to view activity history."
      >
        <div className="flex flex-col h-full space-y-6 p-6">
          <PageHeader pageType="history" />

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5" />
                <CardTitle>Activity History</CardTitle>
              </div>
              <CardDescription>
                View all user actions and changes made to the system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-logs-input"
                    placeholder="Search logs..."
                    className="pl-8"
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  />
                </div>

                <Select 
                  value={filters.tableName || "all"} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, tableName: value === "all" ? "" : value }))}
                >
                  <SelectTrigger id="table-filter-select" data-testid="table-filter-select">
                    <SelectValue placeholder="All Tables" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tables</SelectItem>
                    <SelectItem value="Jobs">Jobs</SelectItem>
                    <SelectItem value="Customer">Customers</SelectItem>
                    <SelectItem value="Driver">Drivers</SelectItem>
                    <SelectItem value="Vehicle">Vehicles</SelectItem>
                  </SelectContent>
                </Select>

                <Select 
                  value={filters.action || "all"} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, action: value === "all" ? "" : value }))}
                >
                  <SelectTrigger id="action-filter-select" data-testid="action-filter-select">
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="CREATE">Created</SelectItem>
                    <SelectItem value="UPDATE">Updated</SelectItem>
                    <SelectItem value="DELETE">Deleted</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  id="start-date-filter-input"
                  data-testid="start-date-filter-input"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                />

                <Input
                  id="end-date-filter-input"
                  data-testid="end-date-filter-input"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Activity className="h-4 w-4" />
                  <span>
                    {filteredLogs.length} of {pagination.total} entries
                  </span>
                </div>
                <Button
                  id="refresh-logs-btn"
                  variant="outline"
                  size="sm"
                  onClick={() => fetchLogs(pagination.page)}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              <Separator />

              {/* Activity Log List */}
              <div id="activity-log-container" className="space-y-3 max-h-130 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading activity logs...</span>
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No activity logs found</p>
                    <p className="text-sm">Try adjusting your filters</p>
                  </div>
                ) : (
                  filteredLogs.map((log) => {
                    const hasDataChanges = log.oldData || log.newData;
                    
                    return (
                      <Card key={log.id} className="hover:bg-muted/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="text-2xl">{getTableIcon(log.tableName)}</div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge className={getActionColor(log.action)}>
                                    {log.action}
                                  </Badge>
                                  <Badge variant="outline">
                                    <Table className="h-3 w-3 mr-1" />
                                    {log.tableName}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">
                                    ID: {log.recordId}
                                  </span>
                                </div>
                                
                                <p className="text-sm font-medium">{log.description}</p>
                                
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    <span>{log.userEmail || log.userId}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <CalendarIcon className="h-3 w-3" />
                                    <span>
                                      {format(parseISO(log.createdAt), 'MMM d, yyyy h:mm a')}
                                    </span>
                                  </div>
                                  {log.ipAddress && (
                                    <span>IP: {log.ipAddress}</span>
                                  )}
                                </div>
                                
                                {/* Expandable data changes section */}
                                {hasDataChanges && (
                                  <Collapsible className="mt-3">
                                    <CollapsibleTrigger asChild>
                                      <Button
                                        id={`expand-log-${log.id}-btn`}
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-2 text-xs gap-2 text-muted-foreground hover:text-foreground"
                                      >
                                        <Database className="h-3 w-3" />
                                        <span>View Data Changes</span>
                                        <ChevronDown className="h-3 w-3" />
                                      </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="mt-2">
                                      <div className="p-3 bg-muted/50 rounded-lg">
                                        {renderDataChanges(log)}
                                      </div>
                                    </CollapsibleContent>
                                  </Collapsible>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.pages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      id="prev-page-btn"
                      data-testid="prev-page-btn"
                      variant="outline"
                      size="sm"
                      onClick={() => fetchLogs(pagination.page - 1)}
                      disabled={pagination.page <= 1 || isLoading}
                    >
                      Previous
                    </Button>
                    <Button
                      id="next-page-btn"
                      data-testid="next-page-btn"
                      variant="outline"
                      size="sm"
                      onClick={() => fetchLogs(pagination.page + 1)}
                      disabled={pagination.page >= pagination.pages || isLoading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    </ProtectedLayout>
  );
}