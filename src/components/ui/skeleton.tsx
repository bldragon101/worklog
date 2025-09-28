"use client";

import React from "react";
import { cn } from "@/lib/utils";

// Base Skeleton Component
interface SkeletonProps extends React.ComponentProps<"div"> {
  variant?: "circle" | "rectangle" | "text";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

export function Skeleton({
  className,
  variant = "text",
  size = "md",
  ...props
}: SkeletonProps) {
  const sizeClasses = {
    xs: "h-2 w-2",
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-6 w-6",
    xl: "h-8 w-8",
  };

  const variantClasses = {
    circle: "rounded-full",
    rectangle: "rounded",
    text: "rounded h-4",
  };

  return (
    <div
      data-slot="skeleton"
      className={cn(
        "bg-gradient-to-r from-muted via-muted/50 to-muted animate-pulse",
        variant === "text" ? variantClasses.text : sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

// Text Skeleton Component
export function SkeletonText({
  className,
  lines = 1,
  ...props
}: React.ComponentProps<"div"> & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={cn("w-full", i === lines - 1 && lines > 1 && "w-3/4")}
        />
      ))}
    </div>
  );
}

// Card Skeleton Component
export function SkeletonCard({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center space-x-4 p-4", className)}
      {...props}
    >
      <Skeleton variant="circle" size="xl" />
      <div className="space-y-2 flex-1">
        <Skeleton variant="text" className="w-3/4" />
        <Skeleton variant="text" className="w-1/2" />
      </div>
    </div>
  );
}

// Table Loading Skeleton - Main Design Pattern
interface TableLoadingSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableLoadingSkeleton({
  rows = 12,
  columns = 8,
}: TableLoadingSkeletonProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 space-y-4 p-4">
        {/* Loading header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-8 w-32 bg-gradient-to-r from-muted via-muted/50 to-muted rounded-md animate-pulse"></div>
            <div className="h-8 w-24 bg-gradient-to-r from-muted via-muted/50 to-muted rounded-md animate-pulse"></div>
          </div>
          <div className="h-8 w-20 bg-gradient-to-r from-muted via-muted/50 to-muted rounded-md animate-pulse"></div>
        </div>

        {/* Table skeleton */}
        <div className="border rounded-lg overflow-hidden">
          {/* Table header skeleton */}
          <div className="border-b bg-muted/30">
            <div
              className={`grid gap-4 p-4`}
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: columns }).map((_, i) => (
                <div
                  key={i}
                  className="h-4 bg-gradient-to-r from-muted/70 via-muted/30 to-muted/70 rounded animate-pulse"
                ></div>
              ))}
            </div>
          </div>

          {/* Table rows skeleton */}
          <div className="divide-y">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                className={`grid gap-4 p-4`}
                style={{
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <div
                    key={colIndex}
                    className="h-4 bg-gradient-to-r from-muted/40 via-muted/20 to-muted/40 rounded animate-pulse"
                    style={{
                      animationDelay: `${rowIndex * 50 + colIndex * 20}ms`,
                      animationDuration: "1.5s",
                    }}
                  ></div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Loading spinner */}
        <div className="flex items-center justify-center space-x-3 py-8">
          <div className="relative">
            <div
              className="w-6 h-6 border-2 rounded-full"
              style={{ borderColor: "rgb(229, 231, 235)" }}
            ></div>
            <div
              className="absolute top-0 left-0 w-6 h-6 border-2 rounded-full animate-spin"
              style={{
                borderColor: "rgb(156, 163, 175)",
                borderTopColor: "transparent",
              }}
            ></div>
          </div>
          <span className="text-sm font-medium text-muted-foreground animate-pulse">
            Loading data...
          </span>
        </div>
      </div>
    </div>
  );
}

// Generic Loading Skeleton
interface LoadingSkeletonProps {
  className?: string;
  count?: number;
  variant?: "card" | "list";
}

export function LoadingSkeleton({
  className,
  count = 5,
  variant = "list",
}: LoadingSkeletonProps) {
  if (variant === "card") {
    return (
      <div className={cn("space-y-4", className)}>
        {Array.from({ length: count }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center space-x-4 p-3">
          <div className="h-6 w-6 bg-gradient-to-r from-muted via-muted/50 to-muted rounded-full animate-pulse"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gradient-to-r from-muted/40 via-muted/20 to-muted/40 rounded animate-pulse w-3/4"></div>
            <div className="h-4 bg-gradient-to-r from-muted/40 via-muted/20 to-muted/40 rounded animate-pulse w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Spinner Component
interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  // Using inline styles to ensure gray colors are applied
  const baseStyle = {
    borderColor: "rgb(229, 231, 235)", // gray-200
  };

  const spinnerStyle = {
    borderColor: "rgb(156, 163, 175)", // gray-400
    borderTopColor: "transparent",
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="relative">
        <div
          className={cn("border-2 rounded-full", sizeClasses[size])}
          style={baseStyle}
        ></div>
        <div
          className={cn(
            "absolute top-0 left-0 border-2 rounded-full animate-spin",
            sizeClasses[size],
          )}
          style={spinnerStyle}
        />
      </div>
    </div>
  );
}

// Loading State Component
interface LoadingStateProps {
  message?: string;
  showSpinner?: boolean;
  className?: string;
}

export function LoadingState({
  message = "Loading...",
  showSpinner = true,
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center p-8", className)}
    >
      {showSpinner && <Spinner size="lg" className="mb-4" />}
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

// Sheet Skeleton Component
interface SheetDetailsContentSkeletonProps<TData> {
  fields: Array<{ id: keyof TData; label: string }>;
}

export function SheetDetailsContentSkeleton<TData>({
  fields,
}: SheetDetailsContentSkeletonProps<TData>) {
  return (
    <dl className="divide-y">
      {fields.map((field) => (
        <div
          key={String(field.id)}
          className="flex gap-4 my-1 py-2 text-sm justify-between items-center w-full"
        >
          <dt className="shrink-0 text-muted-foreground">{field.label}</dt>
          <dd className="font-mono w-full text-right">
            <div className="h-4 bg-gradient-to-r from-muted/40 via-muted/20 to-muted/40 rounded animate-pulse w-20 ml-auto"></div>
          </dd>
        </div>
      ))}
    </dl>
  );
}
