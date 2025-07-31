"use client";

import React from 'react';
import Link from 'next/link';
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/IconLogo";
import { 
  Home, 
  Truck, 
  Settings2, 
  CheckCircle, 
  Clock, 
  ExternalLink,
  BarChart3,
  FileText,
  Wrench,
  Users,
  Building2
} from "lucide-react";

interface PageItem {
  title: string;
  url: string;
  description: string;
  status: 'available' | 'building' | 'planned';
  icon?: React.ComponentType<{ className?: string }>;
}

interface Category {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: PageItem[];
}

const categories: Category[] = [
  {
    title: "Dashboard",
    icon: Home,
    items: [
      {
        title: "Overview",
        url: "/overview",
        description: "Overview of all available pages and features",
        status: 'available',
        icon: Home
      },
      {
        title: "Jobs",
        url: "/jobs",
        description: "View, filter, and manage your job logs",
        status: 'available',
        icon: FileText
      },
      {
        title: "Analytics",
        url: "/analytics",
        description: "Data analytics and insights",
        status: 'planned',
        icon: BarChart3
      },
      {
        title: "Reports",
        url: "/reports",
        description: "Generate and view reports",
        status: 'planned',
        icon: FileText
      }
    ]
  },
  {
    title: "Fleet & Personnel",
    icon: Truck,
    items: [
      {
        title: "Vehicles",
        url: "/vehicles",
        description: "Manage your fleet of vehicles",
        status: 'building',
        icon: Truck
      },
      {
        title: "Drivers",
        url: "/drivers",
        description: "Manage drivers and subcontractors",
        status: 'building',
        icon: Users
      },
      {
        title: "Customers",
        url: "/customers",
        description: "Manage customer information and relationships",
        status: 'available',
        icon: Building2
      },
      {
        title: "Maintenance",
        url: "/maintenance",
        description: "Track vehicle maintenance schedules",
        status: 'planned',
        icon: Wrench
      }
    ]
  },
  {
    title: "Settings",
    icon: Settings2,
    items: [
      {
        title: "General",
        url: "/settings",
        description: "General application settings",
        status: 'planned',
        icon: Settings2
      },
      {
        title: "Users",
        url: "/settings/users",
        description: "Manage user accounts and permissions",
        status: 'planned',
        icon: Users
      },
      {
        title: "Permissions",
        url: "/settings/permissions",
        description: "Configure user roles and permissions",
        status: 'planned',
        icon: Settings2
      },
      {
        title: "Integrations",
        url: "/integrations",
        description: "Manage third-party integrations",
        status: 'available',
        icon: ExternalLink
      }
    ]
  }
];

const getStatusBadge = (status: PageItem['status']) => {
  switch (status) {
    case 'available':
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="w-3 h-3 mr-1" />Available</Badge>;
    case 'building':
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><Clock className="w-3 h-3 mr-1" />Building</Badge>;
    case 'planned':
      return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"><Clock className="w-3 h-3 mr-1" />Planned</Badge>;
  }
};

export default function OverviewPage() {
  return (
    <ProtectedLayout>
      <div className="flex flex-col h-full space-y-6">
        <PageHeader pageType="overview" />

        <div className="grid gap-6">
          {categories.map((category, categoryIndex) => (
            <Card key={categoryIndex} className="border-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <category.icon className="h-6 w-6 text-blue-600" />
                  <CardTitle className="text-xl">{category.title}</CardTitle>
                </div>
                <CardDescription>
                  {category.items.length} page{category.items.length !== 1 ? 's' : ''} in this category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {category.items.map((item, itemIndex) => (
                    <Card 
                      key={itemIndex} 
                      className={`border transition-all duration-200 ${
                        item.status === 'available' 
                          ? 'hover:shadow-lg hover:scale-[1.02] cursor-pointer hover:border-blue-300 dark:hover:border-blue-600' 
                          : 'hover:shadow-md'
                      }`}
                    >
                      {item.status === 'available' ? (
                        <Link href={item.url} className="block">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {item.icon && <item.icon className="h-4 w-4 text-gray-500" />}
                                <CardTitle className="text-base">{item.title}</CardTitle>
                              </div>
                              {getStatusBadge(item.status)}
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {item.description}
                            </p>
                          </CardContent>
                        </Link>
                      ) : (
                        <>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {item.icon && <item.icon className="h-4 w-4 text-gray-500" />}
                                <CardTitle className="text-base">{item.title}</CardTitle>
                              </div>
                              {getStatusBadge(item.status)}
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {item.description}
                            </p>
                          </CardContent>
                        </>
                      )}
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">Legend</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-gray-700 dark:text-gray-300">Available - Fully functional pages</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-600" />
              <span className="text-gray-700 dark:text-gray-300">Building - Pages under development</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-600" />
              <span className="text-gray-700 dark:text-gray-300">Planned - Future features</span>
            </div>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
} 