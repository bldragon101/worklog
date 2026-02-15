"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, Upload, X, ArrowLeft, Mail } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/brand/icon-logo";
import Image from "next/image";
import Link from "next/link";

interface CompanySettingsFormData {
  companyName: string;
  companyAbn: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyLogo: string;
  emailReplyTo: string;
}

export default function CompanySettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [logoPreview, setLogoPreview] = useState<string>("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CompanySettingsFormData>({
    defaultValues: {
      companyName: "",
      companyAbn: "",
      companyAddress: "",
      companyPhone: "",
      companyEmail: "",
      companyLogo: "",
      emailReplyTo: "",
    },
  });

  const companyLogo = watch("companyLogo");

  useEffect(() => {
    if (companyLogo) {
      setLogoPreview(companyLogo);
    }
  }, [companyLogo]);

  useEffect(() => {
    const fetchSettings = async () => {
      setIsFetching(true);
      try {
        const response = await fetch("/api/company-settings");
        if (response.ok) {
          const data = await response.json();
          setValue("companyName", data.companyName || "");
          setValue("companyAbn", data.companyAbn || "");
          setValue("companyAddress", data.companyAddress || "");
          setValue("companyPhone", data.companyPhone || "");
          setValue("companyEmail", data.companyEmail || "");
          setValue("companyLogo", data.companyLogo || "");
          setValue("emailReplyTo", data.emailReplyTo || "");
        }
      } catch (error) {
        console.error("Error fetching company settings:", error);
        toast({
          title: "Error",
          description: "Failed to load company settings",
          variant: "destructive",
        });
      } finally {
        setIsFetching(false);
      }
    };

    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 2MB",
        variant: "destructive",
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Upload failed");
      }

      setValue("companyLogo", data.imageUrl);
      setLogoPreview(data.imageUrl);

      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast({
        title: "Error",
        description: "Failed to upload logo",
        variant: "destructive",
      });
    }
  };

  const handleRemoveLogo = () => {
    setValue("companyLogo", "");
    setLogoPreview("");
  };

  const onSubmit = async (data: CompanySettingsFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/company-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      toast({
        title: "Settings Saved",
        description: "Company settings have been updated successfully",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save company settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
            <Link href="/settings">
              <Button
                type="button"
                variant="outline"
                size="sm"
                id="back-to-settings-btn"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Settings
              </Button>
            </Link>
            <div>
              <h2 className="text-2xl font-bold">Company Settings</h2>
              <p className="text-sm text-muted-foreground">
                Manage company details, branding, and email configuration
              </p>
            </div>
          </div>

          {isFetching ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-6 max-w-3xl"
            >
              {/* Company Details */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <CardTitle>Company Details</CardTitle>
                  </div>
                  <CardDescription>
                    These details appear on RCTI PDFs, email templates, and
                    throughout the application.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Company Logo */}
                  <div className="space-y-2">
                    <Label htmlFor="logo-upload">Company Logo</Label>
                    <div className="flex flex-col gap-3">
                      {logoPreview ? (
                        <div className="relative inline-block">
                          <Image
                            src={logoPreview}
                            alt="Company Logo"
                            width={200}
                            height={96}
                            unoptimized
                            className="h-24 w-auto border rounded-md object-contain"
                          />
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                handleRemoveLogo();
                              }
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            id="remove-logo-btn"
                            title="Remove logo"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <Upload
                            className="mx-auto h-12 w-12 text-gray-400"
                            title="Upload logo"
                          />
                          <p className="mt-2 text-sm text-gray-600">
                            No logo uploaded
                          </p>
                        </div>
                      )}
                      <Input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="cursor-pointer"
                      />
                      <p className="text-xs text-muted-foreground">
                        Recommended: PNG or JPG, max 2MB. Used in RCTI PDFs and
                        email headers.
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Company Name */}
                  <div className="space-y-2">
                    <Label htmlFor="company-name">
                      Company Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="company-name"
                      {...register("companyName", {
                        required: "Company name is required",
                      })}
                      placeholder="Enter company name"
                    />
                    {errors.companyName && (
                      <p className="text-sm text-red-500">
                        {errors.companyName.message}
                      </p>
                    )}
                  </div>

                  {/* Company ABN */}
                  <div className="space-y-2">
                    <Label htmlFor="company-abn">ABN</Label>
                    <Input
                      id="company-abn"
                      {...register("companyAbn")}
                      placeholder="12 345 678 901"
                    />
                  </div>

                  {/* Company Address */}
                  <div className="space-y-2">
                    <Label htmlFor="company-address">Address</Label>
                    <Textarea
                      id="company-address"
                      {...register("companyAddress")}
                      placeholder="Enter company address"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Company Phone */}
                    <div className="space-y-2">
                      <Label htmlFor="company-phone">Phone</Label>
                      <Input
                        id="company-phone"
                        {...register("companyPhone")}
                        placeholder="(03) 1234 5678"
                      />
                    </div>

                    {/* Company Email */}
                    <div className="space-y-2">
                      <Label htmlFor="company-email">Email</Label>
                      <Input
                        id="company-email"
                        type="email"
                        {...register("companyEmail")}
                        placeholder="info@company.com.au"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Email Settings */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-blue-600" />
                    <CardTitle>Email Settings</CardTitle>
                  </div>
                  <CardDescription>
                    Configure how RCTI emails are sent to drivers. Emails are
                    sent from <strong>rcti@mg.worklog.gwtpt.com.au</strong> via
                    Resend.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email-reply-to">
                      Reply-To Email Address
                    </Label>
                    <Input
                      id="email-reply-to"
                      type="email"
                      {...register("emailReplyTo")}
                      placeholder="accounts@company.com.au"
                    />
                    <p className="text-xs text-muted-foreground">
                      When a driver replies to an RCTI email, the reply will be
                      sent to this address. If not set, the company email above
                      will be used instead.
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/50 border p-4 space-y-2">
                    <h4 className="text-sm font-medium">
                      How RCTI emails work
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>
                        The email button appears on finalised and paid RCTIs
                      </li>
                      <li>
                        Drivers must have an email address configured in their
                        profile
                      </li>
                      <li>
                        The RCTI PDF is automatically attached to the email
                      </li>
                      <li>
                        Company logo and details from above are included in the
                        email template
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isLoading}
                  id="save-company-settings-btn"
                  className="min-w-[160px]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Settings"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </ProtectedRoute>
    </ProtectedLayout>
  );
}
