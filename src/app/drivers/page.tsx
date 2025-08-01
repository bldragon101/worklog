"use client";
import React from 'react';
import { ProtectedLayout } from "@/components/protected-layout";
import { PageHeader } from "@/components/icon-logo";

const DriversPage = () => {
  return (
    <ProtectedLayout>
      <div className="flex flex-col h-full space-y-4">
        <PageHeader pageType="drivers" />
      </div>
    </ProtectedLayout>
  );
};

export default DriversPage;
