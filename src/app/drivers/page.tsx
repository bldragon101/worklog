"use client";
import React from 'react';
import { ProtectedLayout } from "@/components/protected-layout";

const DriversPage = () => {
  return (
    <ProtectedLayout>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="WorkLog Logo" className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">Drivers and Subcontractors</h1>
            <p className="text-muted-foreground">This is the placeholder page for drivers and subcontractors.</p>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
};

export default DriversPage;
