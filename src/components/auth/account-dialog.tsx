"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { UserProfile } from "@clerk/nextjs";
import { Logo } from "../brand/logo";

interface AccountDialogProps {
  children?: React.ReactNode;
}

export function AccountDialog({ children }: AccountDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Account Settings
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="!max-w-6xl !w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Logo width={24} height={24} className="h-6 w-6" />
            Account Settings
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <UserProfile
            routing="hash"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none p-0",
              }
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
} 