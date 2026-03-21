"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, ArrowLeft, Grid3X3 } from "lucide-react";
import { PageHeader } from "@/components/brand/icon-logo";
import Link from "next/link";

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [signUpEnabled, setSignUpEnabled] = useState(true);
  const [quickEditMinRole, setQuickEditMinRole] = useState("admin");
  const [isSavingQuickEdit, setIsSavingQuickEdit] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      setIsFetching(true);
      try {
        const [response, qeResponse] = await Promise.all([
          fetch("/api/admin/settings"),
          fetch("/api/admin/quick-edit-settings"),
        ]);

        if (!response.ok || !qeResponse.ok) {
          throw new Error("Failed to load admin settings");
        }

        const [data, qeData] = await Promise.all([
          response.json(),
          qeResponse.json(),
        ]);

        setSignUpEnabled(data.signUpEnabled);
        setQuickEditMinRole(qeData.quickEditMinRole || "admin");
      } catch (error) {
        console.error("Error fetching admin settings:", error);
        toast({
          title: "Error",
          description: "Failed to load admin settings",
          variant: "destructive",
        });
      } finally {
        setIsFetching(false);
      }
    };

    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleSignUp = async (checked: boolean) => {
    setIsSaving(true);
    const previousValue = signUpEnabled;
    setSignUpEnabled(checked);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signUpEnabled: checked }),
      });

      if (!response.ok) {
        throw new Error("Failed to update setting");
      }

      toast({
        title: "Setting Updated",
        description: checked
          ? "Sign-up page is now enabled"
          : "Sign-up page is now disabled. New users will see a 401 unauthorised page.",
      });
    } catch (error) {
      console.error("Error updating sign-up setting:", error);
      setSignUpEnabled(previousValue);
      toast({
        title: "Error",
        description: "Failed to update sign-up setting",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickEditRoleChange = async (value: string) => {
    setIsSavingQuickEdit(true);
    const previousValue = quickEditMinRole;
    setQuickEditMinRole(value);

    try {
      const response = await fetch("/api/admin/quick-edit-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quickEditMinRole: value }),
      });

      if (!response.ok) {
        throw new Error("Failed to update setting");
      }

      const roleLabels: Record<string, string> = {
        admin: "Admin",
        manager: "Manager",
        user: "User",
        viewer: "Viewer",
      };

      toast({
        title: "Setting Updated",
        description: `Quick edit minimum role set to ${roleLabels[value] || value}`,
      });
    } catch (error) {
      console.error("Error updating quick edit setting:", error);
      setQuickEditMinRole(previousValue);
      toast({
        title: "Error",
        description: "Failed to update quick edit setting",
        variant: "destructive",
      });
    } finally {
      setIsSavingQuickEdit(false);
    }
  };

  return (
    <ProtectedLayout>
      <ProtectedRoute
        requiredRole="admin"
        fallbackTitle="Admin Access Required"
        fallbackDescription="You need admin privileges to view this page."
      >
        <div className="flex flex-col h-full space-y-6 p-6">
          <PageHeader pageType="settings" />

          <div className="flex items-center gap-4">
            <Button
              asChild
              variant="outline"
              size="sm"
              id="back-to-settings-btn"
            >
              <Link href="/settings">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Settings
              </Link>
            </Button>
            <div>
              <h2 className="text-2xl font-bold">Admin Settings</h2>
              <p className="text-sm text-muted-foreground">
                Manage application-level security and access controls
              </p>
            </div>
          </div>

          {isFetching ? (
            <div className="flex items-center justify-center py-16">
              <Loader2
                className="h-8 w-8 animate-spin text-muted-foreground"
                aria-label="Loading"
              />
              <span className="sr-only">Loading</span>
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    <CardTitle>Authentication</CardTitle>
                  </div>
                  <CardDescription>
                    Control how users can access the application.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-1 pr-4">
                      <Label
                        htmlFor="sign-up-toggle"
                        className="text-base font-medium"
                      >
                        Allow new account sign-ups
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        When disabled, the sign-up page will return a 401
                        unauthorised response. Only existing users will be able
                        to sign in.
                      </p>
                    </div>
                    <Switch
                      id="sign-up-toggle"
                      checked={signUpEnabled}
                      onCheckedChange={handleToggleSignUp}
                      disabled={isSaving}
                      aria-label="Toggle sign-up page"
                    />
                  </div>

                  <div className="rounded-lg bg-muted/50 border p-4 space-y-2">
                    <h4 className="text-sm font-medium">How this works</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>
                        When enabled, anyone can create a new account via the
                        sign-up page
                      </li>
                      <li>
                        When disabled, visiting /sign-up will return a 401
                        unauthorised error
                      </li>
                      <li>
                        Existing users can always sign in regardless of this
                        setting
                      </li>
                      <li>
                        This does not affect users already signed in or
                        SSO-based authentication
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Grid3X3 className="h-5 w-5 text-blue-600" />
                    <CardTitle>Quick Edit</CardTitle>
                  </div>
                  <CardDescription>
                    Control which user roles can use the inline quick edit mode
                    on the jobs table.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-1 pr-4">
                      <Label
                        htmlFor="quick-edit-min-role-select"
                        className="text-base font-medium"
                      >
                        Minimum role for quick edit
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Only users with this role or higher will see the quick
                        edit toggle on the jobs page.
                      </p>
                    </div>
                    <Select
                      value={quickEditMinRole}
                      onValueChange={handleQuickEditRoleChange}
                      disabled={isSavingQuickEdit}
                    >
                      <SelectTrigger
                        id="quick-edit-min-role-select"
                        className="w-40"
                      >
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-lg bg-muted/50 border p-4 space-y-2">
                    <h4 className="text-sm font-medium">How this works</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>
                        Quick edit allows inline editing of jobs directly in the
                        table, similar to a spreadsheet
                      </li>
                      <li>
                        Users below the minimum role will not see the quick edit
                        toggle button
                      </li>
                      <li>
                        Changes are batched and saved together, not individually
                      </li>
                      <li>
                        Setting to &quot;Viewer&quot; allows all users to use
                        quick edit
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </ProtectedRoute>
    </ProtectedLayout>
  );
}
