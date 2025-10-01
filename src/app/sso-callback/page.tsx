"use client";

import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function SSOCallbackPage() {
  const { toast } = useToast();

  useEffect(() => {
    // Show success toast and redirect to overview after a short delay
    const timer = setTimeout(() => {
      toast({
        title: "Success!",
        description: "You have been logged in successfully.",
        variant: "success",
      });
      // Use window.location for more reliable redirect
      window.location.href = "/overview";
    }, 1000);

    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div
          className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-gray-400 mx-auto"
          style={{ borderTopColor: "rgb(156, 163, 175)" }}
        ></div>
        <p className="mt-4 text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
}
