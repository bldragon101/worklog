"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface MobileErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface MobileErrorBoundaryProps {
  children: React.ReactNode;
  fallbackMessage?: string;
}

export class MobileErrorBoundary extends React.Component<
  MobileErrorBoundaryProps,
  MobileErrorBoundaryState
> {
  constructor(props: MobileErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): MobileErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Mobile component error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="mb-3">
          <CardContent className="p-4">
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">
                  Unable to display content
                </h3>
                <p className="text-xs text-muted-foreground">
                  {this.props.fallbackMessage || 
                   "Something went wrong with the mobile view. Please try refreshing or switch to desktop view."}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={this.handleRetry}
                className="mt-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}