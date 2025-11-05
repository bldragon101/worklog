"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Building2, Upload, X } from "lucide-react";

interface RctiSettings {
  companyName: string;
  companyAbn: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyLogo: string;
}

interface RctiSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function RctiSettingsDialog({
  open,
  onOpenChange,
  onSaved,
}: RctiSettingsDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [logoPreview, setLogoPreview] = useState<string>("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RctiSettings>({
    defaultValues: {
      companyName: "",
      companyAbn: "",
      companyAddress: "",
      companyPhone: "",
      companyEmail: "",
      companyLogo: "",
    },
  });

  const companyLogo = watch("companyLogo");

  useEffect(() => {
    if (companyLogo) {
      setLogoPreview(companyLogo);
    }
  }, [companyLogo]);

  useEffect(() => {
    if (open) {
      fetchSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchSettings = async () => {
    setIsFetching(true);
    try {
      const response = await fetch("/api/rcti-settings");
      if (response.ok) {
        const data = await response.json();
        setValue("companyName", data.companyName || "");
        setValue("companyAbn", data.companyAbn || "");
        setValue("companyAddress", data.companyAddress || "");
        setValue("companyPhone", data.companyPhone || "");
        setValue("companyEmail", data.companyEmail || "");
        setValue("companyLogo", data.companyLogo || "");
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast({
        title: "Error",
        description: "Failed to load RCTI settings",
        variant: "destructive",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
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

  const onSubmit = async (data: RctiSettings) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/rcti-settings", {
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
        title: "Success",
        description: "RCTI settings saved successfully",
      });

      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save RCTI settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <DialogTitle>RCTI Settings</DialogTitle>
          </div>
          <DialogDescription>
            Configure company details for RCTI PDF generation. These details
            will appear in the header and footer of generated RCTIs.
          </DialogDescription>
        </DialogHeader>

        {isFetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Company Logo */}
            <div className="space-y-2">
              <Label htmlFor="logo-upload">Company Logo</Label>
              <div className="flex flex-col gap-3">
                {logoPreview ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoPreview}
                      alt="Company Logo"
                      className="h-24 w-auto border rounded-md"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      id="remove-logo-button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
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
                <p className="text-xs text-gray-500">
                  Recommended: PNG or JPG, max 2MB
                </p>
              </div>
            </div>

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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                id="cancel-rcti-settings-button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                id="save-rcti-settings-button"
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
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
