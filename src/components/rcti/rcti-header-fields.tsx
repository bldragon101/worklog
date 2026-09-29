"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RctiHeaderFieldsState } from "@/hooks/use-rcti-header-fields";

export interface RctiHeaderFieldsProps {
  fields: RctiHeaderFieldsState;
  status: string;
}

export function RctiHeaderFields({ fields, status }: RctiHeaderFieldsProps) {
  const {
    businessName,
    setBusinessName,
    driverAddress,
    setDriverAddress,
    driverAbn,
    setDriverAbn,
    gstStatus,
    setGstStatus,
    gstMode,
    setGstMode,
    bankAccountName,
    setBankAccountName,
    bankBsb,
    setBankBsb,
    bankAccountNumber,
    setBankAccountNumber,
    notes,
    setNotes,
  } = fields;

  return (
    <div className="pt-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="business-name">Business/Trading Name</Label>
          <Input
            id="business-name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            disabled={status !== "draft"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-address">Address</Label>
          <Input
            id="driver-address"
            value={driverAddress}
            onChange={(e) => setDriverAddress(e.target.value)}
            disabled={status !== "draft"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-abn">ABN</Label>
          <Input
            id="driver-abn"
            value={driverAbn}
            onChange={(e) => setDriverAbn(e.target.value)}
            disabled={status !== "draft"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gst-status">GST Status</Label>
          <Select
            value={gstStatus}
            onValueChange={(value) =>
              setGstStatus(value as "registered" | "not_registered")
            }
            disabled={status !== "draft"}
          >
            <SelectTrigger id="gst-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_registered">Not Registered</SelectItem>
              <SelectItem value="registered">Registered</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gst-mode">GST Mode</Label>
          <Select
            value={gstMode}
            onValueChange={(value) =>
              setGstMode(value as "exclusive" | "inclusive")
            }
            disabled={status !== "draft" || gstStatus === "not_registered"}
          >
            <SelectTrigger id="gst-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exclusive">Exclusive</SelectItem>
              <SelectItem value="inclusive">Inclusive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bank-account-name">Bank Account Name</Label>
          <Input
            id="bank-account-name"
            value={bankAccountName}
            onChange={(e) => setBankAccountName(e.target.value)}
            disabled={status !== "draft"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bank-bsb">BSB</Label>
          <Input
            id="bank-bsb"
            value={bankBsb}
            onChange={(e) => setBankBsb(e.target.value)}
            disabled={status !== "draft"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bank-account-number">Account Number</Label>
          <Input
            id="bank-account-number"
            value={bankAccountNumber}
            onChange={(e) => setBankAccountNumber(e.target.value)}
            disabled={status !== "draft"}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={status !== "draft"}
          rows={3}
        />
      </div>
    </div>
  );
}
