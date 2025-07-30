"use client";

import React from 'react';
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/Logo";
import { FileText, Clock, ArrowLeft } from "lucide-react";
import Link from 'next/link';

export default function ReportsPage() {
  return (
    <ProtectedLayout>
      <div className="flex flex-col h-full space-y-6 p-6">
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Logo width={48} height={48} className="h-12 w-12" />
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">Reports</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">Generate and view comprehensive business reports.</p>
            </div>
          </div>
        </header>

        <Card className="border-2 border-dashed border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-yellow-100 dark:bg-yellow-900 rounded-full">
                <FileText className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <CardTitle className="text-2xl text-yellow-800 dark:text-yellow-200">Coming Soon</CardTitle>
            <CardDescription className="text-yellow-700 dark:text-yellow-300">
              Reports module is currently under development
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-yellow-700 dark:text-yellow-300">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Planned for future release</span>
            </div>
            <Separator />
            <div className="text-sm text-yellow-600 dark:text-yellow-400 space-y-2">
              <p>This page will include:</p>
              <ul className="list-disc list-inside space-y-1 text-left max-w-md mx-auto">
                <li>Financial reports and statements</li>
                <li>Job completion summaries</li>
                <li>Driver performance reports</li>
                <li>Vehicle maintenance reports</li>
                <li>Custom report builder</li>
                <li>Export to PDF and Excel</li>
              </ul>
            </div>
            <div className="pt-4">
              <Link href="/overview">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Overview
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedLayout>
  );
} 