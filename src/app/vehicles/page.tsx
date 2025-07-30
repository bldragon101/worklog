"use client";
import React from 'react';
import { ProtectedLayout } from "@/components/protected-layout";
import { Logo } from "@/components/Logo";

const VehiclesPage = () => {
  return (
    <ProtectedLayout>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex items-center gap-3">
          <Logo width={32} height={32} className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">Vehicles</h1>
            <p className="text-muted-foreground">This is the placeholder page for vehicles.</p>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
};

export default VehiclesPage;
