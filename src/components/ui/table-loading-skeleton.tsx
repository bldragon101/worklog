"use client";

import React from "react";

interface TableLoadingSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableLoadingSkeleton({ 
  rows = 12, 
  columns = 8 
}: TableLoadingSkeletonProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Table Loading Skeleton */}
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
            <div className={`grid gap-4 p-4`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {Array.from({ length: columns }).map((_, i) => (
                <div key={i} className="h-4 bg-gradient-to-r from-muted/70 via-muted/30 to-muted/70 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
          
          {/* Table rows skeleton */}
          <div className="divide-y">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <div key={rowIndex} className={`grid gap-4 p-4`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <div 
                    key={colIndex} 
                    className="h-4 bg-gradient-to-r from-muted/40 via-muted/20 to-muted/40 rounded animate-pulse"
                    style={{
                      animationDelay: `${(rowIndex * 50) + (colIndex * 20)}ms`,
                      animationDuration: '1.5s'
                    }}
                  ></div>
                ))}
              </div>
            ))}
          </div>
        </div>
        
        {/* Loading text with spinner */}
        <div className="flex items-center justify-center space-x-3 py-8">
          <div className="relative">
            <div className="w-6 h-6 border-2 border-primary/20 rounded-full"></div>
            <div className="absolute top-0 left-0 w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <span className="text-sm font-medium text-muted-foreground animate-pulse">
            Loading data...
          </span>
        </div>
      </div>
    </div>
  );
}