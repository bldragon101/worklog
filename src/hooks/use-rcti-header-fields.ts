/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import type { Driver, Rcti } from "@/lib/types";

/**
 * Holds the editable RCTI header fields (business, ABN, GST and bank details
 * plus notes), auto-populating them from the driver when a single driver is
 * selected and no RCTI is open.
 */
export function useRctiHeaderFields({
  selectedDriverIds,
  drivers,
  selectedRcti,
}: {
  selectedDriverIds: string[];
  drivers: Driver[];
  selectedRcti: Rcti | null;
}) {
  const [businessName, setBusinessName] = useState("");
  const [driverAddress, setDriverAddress] = useState("");
  const [driverAbn, setDriverAbn] = useState("");
  const [gstStatus, setGstStatus] = useState<"registered" | "not_registered">(
    "not_registered",
  );
  const [gstMode, setGstMode] = useState<"exclusive" | "inclusive">(
    "exclusive",
  );
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankBsb, setBankBsb] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (selectedDriverIds.length === 1 && !selectedRcti) {
      const selectedDriver = drivers.find(
        (d) => d.id === parseInt(selectedDriverIds[0], 10),
      );
      if (selectedDriver) {
        setBusinessName(selectedDriver.businessName || "");
        setDriverAddress(selectedDriver.address || "");
        setDriverAbn(selectedDriver.abn || "");
        setGstStatus(
          (selectedDriver.gstStatus as "registered" | "not_registered") ||
            "not_registered",
        );
        setGstMode(
          (selectedDriver.gstMode as "exclusive" | "inclusive") || "exclusive",
        );
        setBankAccountName(selectedDriver.bankAccountName || "");
        setBankBsb(selectedDriver.bankBsb || "");
        setBankAccountNumber(selectedDriver.bankAccountNumber || "");
      }
    }
  }, [selectedDriverIds, drivers, selectedRcti]);

  const loadFromRcti = ({ rcti }: { rcti: Rcti }) => {
    setBusinessName(rcti.businessName || "");
    setDriverAddress(rcti.driverAddress || "");
    setDriverAbn(rcti.driverAbn || "");
    setGstStatus(rcti.gstStatus as "registered" | "not_registered");
    setGstMode(rcti.gstMode as "exclusive" | "inclusive");
    setBankAccountName(rcti.bankAccountName || "");
    setBankBsb(rcti.bankBsb || "");
    setBankAccountNumber(rcti.bankAccountNumber || "");
    setNotes(rcti.notes || "");
  };

  const clearFields = () => {
    setBusinessName("");
    setDriverAddress("");
    setDriverAbn("");
    setGstStatus("not_registered");
    setGstMode("exclusive");
    setBankAccountName("");
    setBankBsb("");
    setBankAccountNumber("");
    setNotes("");
  };

  return {
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
    loadFromRcti,
    clearFields,
  };
}

export type RctiHeaderFieldsState = ReturnType<typeof useRctiHeaderFields>;
