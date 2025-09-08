import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  className?: string;
  count?: number;
  height?: string;
}

export function LoadingSkeleton({
  className,
  count = 5,
  height = "h-16",
}: LoadingSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn("animate-pulse bg-muted rounded", height, className)}
        />
      ))}
    </>
  );
}

interface TableLoadingSkeletonProps {
  columnCount: number;
  rowCount?: number;
}

export function TableLoadingSkeleton({
  columnCount,
  rowCount = 5,
}: TableLoadingSkeletonProps) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex border-b border-border">
          {Array.from({ length: columnCount }).map((_, colIndex) => (
            <div
              key={colIndex}
              className={cn(
                "flex-1 p-4 animate-pulse",
                colIndex === 0 ? "w-16" : "flex-1",
              )}
            >
              <div className="h-4 bg-muted rounded" />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div
        className={cn(
          "animate-spin rounded border-2 border-muted border-t-primary",
          sizeClasses[size],
        )}
      />
    </div>
  );
}

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
