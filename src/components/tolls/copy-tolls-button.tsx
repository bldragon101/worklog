"use client";

import { ClipboardCopy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

/** Copies toll details as plain text for pasting into the invoicing system */
export function CopyTollsButton({
  id,
  getText,
  description,
  label,
  disabled = false,
}: {
  id: string;
  /** Built on click so large tables are only formatted when copied */
  getText: () => string;
  /** What was copied, shown in the confirmation toast */
  description: string;
  /** Button text; an icon-only button when omitted */
  label?: string;
  disabled?: boolean;
}) {
  const { toast } = useToast();

  const handleCopy = async () => {
    const text = getText();
    if (!text) {
      toast({
        title: "Nothing to copy",
        description: "There are no toll trips to copy.",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard", description });
    } catch (error) {
      console.error("Copy tolls failed:", error);
      toast({
        title: "Copy failed",
        description: "Could not copy the toll details to your clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      id={id}
      type="button"
      variant={label ? "outline" : "ghost"}
      size="sm"
      disabled={disabled}
      onClick={() => void handleCopy()}
      className={label ? "h-8 gap-2" : "h-7 w-7 p-0"}
      title={label ? undefined : "Copy tolls for invoicing"}
      aria-label={label ? undefined : "Copy tolls for invoicing"}
    >
      <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
