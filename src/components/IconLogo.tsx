"use client";

import React from 'react';
import { 
  Briefcase, 
  Users, 
  Truck, 
  Settings, 
  FileText, 
  Wrench, 
  Home,
  UserCircle,
  Building2,
  ChartLine,
  Database
} from "lucide-react";

type PageType = 
  | "jobs" 
  | "customers" 
  | "vehicles" 
  | "drivers" 
  | "settings" 
  | "analytics" 
  | "reports" 
  | "maintenance" 
  | "overview"
  | "user-profile"
  | "integrations";

interface IconLogoProps {
  pageType: PageType;
  size?: number;
  className?: string;
}

const getIconForPage = (pageType: PageType) => {
  switch (pageType) {
    case "jobs":
      return Briefcase;
    case "customers":
      return Users;
    case "vehicles":
      return Truck;
    case "drivers":
      return UserCircle;
    case "settings":
      return Settings;
    case "analytics":
      return ChartLine;
    case "reports":
      return FileText;
    case "maintenance":
      return Wrench;
    case "overview":
      return Home;
    case "user-profile":
      return UserCircle;
    case "integrations":
      return Building2;
    default:
      return Database; // Default fallback icon
  }
};

const getPageTitle = (pageType: PageType) => {
  switch (pageType) {
    case "jobs":
      return "Jobs";
    case "customers":
      return "Customers";
    case "vehicles":
      return "Vehicles";
    case "drivers":
      return "Drivers";
    case "settings":
      return "Settings";
    case "analytics":
      return "Analytics";
    case "reports":
      return "Reports";
    case "maintenance":
      return "Maintenance";
    case "overview":
      return "Overview";
    case "user-profile":
      return "User Profile";
    case "integrations":
      return "Integrations";
    default:
      return "Dashboard";
  }
};

const getPageDescription = (pageType: PageType) => {
  switch (pageType) {
    case "jobs":
      return "View, filter, and manage your jobs.";
    case "customers":
      return "Manage your customer database.";
    case "vehicles":
      return "Track and manage your fleet vehicles.";
    case "drivers":
      return "Manage driver information and schedules.";
    case "settings":
      return "Configure application settings and preferences.";
    case "analytics":
      return "View detailed analytics and insights.";
    case "reports":
      return "Generate and view comprehensive reports.";
    case "maintenance":
      return "Schedule and track vehicle maintenance.";
    case "overview":
      return "Get an overview of your operations.";
    case "user-profile":
      return "Manage your profile and account settings.";
    case "integrations":
      return "Configure third-party integrations.";
    default:
      return "Manage your worklog operations.";
  }
};

export function IconLogo({ pageType, size = 48, className = "" }: IconLogoProps) {
  const IconComponent = getIconForPage(pageType);
  
  return (
    <div className={`rounded-lg bg-primary/10 p-3 ${className}`}>
      <IconComponent 
        size={size} 
        className="text-primary"
      />
    </div>
  );
}

export function PageHeader({ pageType, className = "" }: { pageType: PageType; className?: string }) {
  return (
    <div className={`bg-gradient-to-br from-blue-50/30 to-indigo-100/30 dark:from-transparent dark:to-transparent p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <IconLogo pageType={pageType} size={32} />
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
              {getPageTitle(pageType)}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">
              {getPageDescription(pageType)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export types and utilities for use in other components
export type { PageType };
export { getIconForPage, getPageTitle, getPageDescription };