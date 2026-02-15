"use client";

import { ProtectedLayout } from "@/components/layout/protected-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/brand/icon-logo";
import { Building2, Clock, Users, ArrowRight, ArrowLeft } from "lucide-react";
import Link from "next/link";

const settingsSections = [
  {
    title: "Company Settings",
    description:
      "Manage company details, logo, and email configuration for RCTI notifications.",
    href: "/settings/company",
    icon: Building2,
    available: true,
  },
  {
    title: "User Management",
    description:
      "Manage user accounts, roles, and permissions for your organisation.",
    href: "/settings/users",
    icon: Users,
    available: true,
  },
  {
    title: "Activity History",
    description: "View audit logs and activity history across the application.",
    href: "/settings/history",
    icon: Clock,
    available: true,
  },
];

export default function SettingsPage() {
  return (
    <ProtectedLayout>
      <ProtectedRoute
        requiredPermission="access_settings"
        fallbackTitle="Settings Access Required"
        fallbackDescription="You need settings access permission to view this page."
      >
        <div className="flex flex-col h-full space-y-6 p-6">
          <PageHeader pageType="settings" />

          <div className="flex items-center gap-4">
            <Link href="/overview">
              <Button
                type="button"
                variant="outline"
                size="sm"
                id="back-to-overview-btn"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Overview
              </Button>
            </Link>
            <div>
              <h2 className="text-2xl font-bold">Settings</h2>
              <p className="text-sm text-muted-foreground">
                Configure your organisation and application preferences
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-5xl">
            {settingsSections.map((section) => {
              const IconComponent = section.icon;
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  id={`settings-link-${section.href.split("/").filter(Boolean).pop()}`}
                >
                  <Card className="h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                          <IconComponent className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <CardTitle className="text-lg">{section.title}</CardTitle>
                      <CardDescription>{section.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <span className="text-sm text-primary font-medium">
                        Configure
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </ProtectedRoute>
    </ProtectedLayout>
  );
}
