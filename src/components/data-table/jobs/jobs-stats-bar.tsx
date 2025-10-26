"use client";

import * as React from "react";
import { Table } from "@tanstack/react-table";
import { Job } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { BarChart3, RefreshCw } from "lucide-react";

interface JobsStatsBarProps {
  table: Table<Job>;
}

interface TruckTypeStats {
  count: number;
  hours: number;
}

interface JobStats {
  tray: TruckTypeStats;
  crane: TruckTypeStats;
  semi: TruckTypeStats;
  semiCrane: TruckTypeStats;
  eastlink: number;
  citylink: number;
}

// Custom comparison function that ignores table prop changes to prevent unnecessary re-renders
const arePropsEqual = () => {
  // Always return true since we manually control when to refresh via the button
  // This prevents re-renders during search/filtering
  return true;
};

export const JobsStatsBar = React.memo(function JobsStatsBar({
  table,
}: JobsStatsBarProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [showCompact, setShowCompact] = React.useState(false);
  const [stats, setStats] = React.useState<JobStats>({
    tray: { count: 0, hours: 0 },
    crane: { count: 0, hours: 0 },
    semi: { count: 0, hours: 0 },
    semiCrane: { count: 0, hours: 0 },
    eastlink: 0,
    citylink: 0,
  });

  // Calculate stats from filtered rows - stable function that doesn't cause re-renders
  const calculateStats = React.useCallback(() => {
    const filteredRows = table.getFilteredRowModel().rows;

    const result: JobStats = {
      tray: { count: 0, hours: 0 },
      crane: { count: 0, hours: 0 },
      semi: { count: 0, hours: 0 },
      semiCrane: { count: 0, hours: 0 },
      eastlink: 0,
      citylink: 0,
    };

    filteredRows.forEach((row) => {
      const job = row.original;
      const hours = job.chargedHours || 0;

      // Categorize by truck type
      const truckType = job.truckType?.toUpperCase() || "";

      if (truckType.includes("TRAY") && !truckType.includes("CRANE")) {
        result.tray.count++;
        result.tray.hours += hours;
      } else if (truckType.includes("CRANE") && !truckType.includes("SEMI")) {
        result.crane.count++;
        result.crane.hours += hours;
      } else if (truckType.includes("SEMI") && truckType.includes("CRANE")) {
        result.semiCrane.count++;
        result.semiCrane.hours += hours;
      } else if (truckType.includes("SEMI")) {
        result.semi.count++;
        result.semi.hours += hours;
      }

      // Sum tolls
      result.eastlink += job.eastlink || 0;
      result.citylink += job.citylink || 0;
    });

    setStats(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove table dependency to prevent re-creation on every table change

  // Initialize stats on mount only
  React.useEffect(() => {
    calculateStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Check if we should show compact view
  React.useEffect(() => {
    const checkWidth = () => {
      setShowCompact(window.innerWidth < 1200);
    };

    checkWidth();
    window.addEventListener("resize", checkWidth);

    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  const StatItem = ({ label, value }: { label: string; value: string }) => {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {label}
        </div>
        <div className="text-xs font-mono font-semibold">{value}</div>
      </div>
    );
  };

  const hasAnyStats =
    stats.tray.count > 0 ||
    stats.crane.count > 0 ||
    stats.semi.count > 0 ||
    stats.semiCrane.count > 0 ||
    stats.eastlink > 0 ||
    stats.citylink > 0;

  if (!hasAnyStats) return null;

  return (
    <>
      <div className="hidden md:flex items-center justify-center gap-3">
        {showCompact ? (
          <Button
            id="jobs-stats-button"
            variant="outline"
            size="sm"
            onClick={() => setIsDialogOpen(true)}
            className="gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Stats
          </Button>
        ) : (
          <div className="flex items-center gap-2 border rounded h-9 px-3 bg-background shadow-xs dark:bg-input/30 dark:border-input">
            <button
              id="refresh-stats-button"
              onClick={(e) => {
                e.stopPropagation();
                calculateStats();
              }}
              className="h-6 w-6 p-0 flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity"
              title="Refresh stats"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
            <div className="h-4 w-px bg-border" />
            <div
              className="flex gap-3 items-center cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setIsDialogOpen(true)}
              title="Click to view detailed stats"
            >
              {stats.tray.count > 0 && (
                <StatItem
                  label="TT"
                  value={`${stats.tray.count} - ${stats.tray.hours.toFixed(1)}h`}
                />
              )}
              {stats.tray.count > 0 && stats.crane.count > 0 && (
                <div className="h-6 w-px bg-border" />
              )}
              {stats.crane.count > 0 && (
                <StatItem
                  label="CT"
                  value={`${stats.crane.count} - ${stats.crane.hours.toFixed(1)}h`}
                />
              )}
              {stats.crane.count > 0 && stats.semi.count > 0 && (
                <div className="h-6 w-px bg-border" />
              )}
              {stats.semi.count > 0 && (
                <StatItem
                  label="ST"
                  value={`${stats.semi.count} - ${stats.semi.hours.toFixed(1)}h`}
                />
              )}
              {stats.semi.count > 0 && stats.semiCrane.count > 0 && (
                <div className="h-6 w-px bg-border" />
              )}
              {stats.semiCrane.count > 0 && (
                <StatItem
                  label="SCT"
                  value={`${stats.semiCrane.count} - ${stats.semiCrane.hours.toFixed(1)}h`}
                />
              )}
              {(stats.semiCrane.count > 0 ||
                stats.semi.count > 0 ||
                stats.crane.count > 0 ||
                stats.tray.count > 0) &&
                (stats.eastlink > 0 || stats.citylink > 0) && (
                  <div className="h-6 w-px bg-border mx-1" />
                )}
              {stats.eastlink > 0 && (
                <StatItem label="EL" value={`${stats.eastlink}`} />
              )}
              {stats.eastlink > 0 && stats.citylink > 0 && (
                <div className="h-6 w-px bg-border" />
              )}
              {stats.citylink > 0 && (
                <StatItem label="CL" value={`${stats.citylink}`} />
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filtered Jobs Statistics</DialogTitle>
            <DialogDescription>
              Summary of jobs based on current filters and search
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Legend */}
            <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
              <div className="font-semibold text-muted-foreground mb-2">
                Legend
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-mono font-semibold">TT</span> - Tray
                </div>
                <div>
                  <span className="font-mono font-semibold">CT</span> - Crane
                </div>
                <div>
                  <span className="font-mono font-semibold">ST</span> - Semi
                </div>
                <div>
                  <span className="font-mono font-semibold">SCT</span> - Semi
                  Crane
                </div>
                <div>
                  <span className="font-mono font-semibold">EL</span> - Eastlink
                </div>
                <div>
                  <span className="font-mono font-semibold">CL</span> - Citylink
                </div>
              </div>
            </div>
            {/* Truck Types Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                Truck Types
              </h3>
              <div className="space-y-2">
                {stats.tray.count > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="font-medium">Tray</span>
                    <div className="text-right">
                      <div className="text-sm">
                        {stats.tray.count} job
                        {stats.tray.count !== 1 ? "s" : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {stats.tray.hours.toFixed(2)} hours
                      </div>
                    </div>
                  </div>
                )}
                {stats.crane.count > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="font-medium">Crane</span>
                    <div className="text-right">
                      <div className="text-sm">
                        {stats.crane.count} job
                        {stats.crane.count !== 1 ? "s" : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {stats.crane.hours.toFixed(2)} hours
                      </div>
                    </div>
                  </div>
                )}
                {stats.semi.count > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="font-medium">Semi</span>
                    <div className="text-right">
                      <div className="text-sm">
                        {stats.semi.count} job
                        {stats.semi.count !== 1 ? "s" : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {stats.semi.hours.toFixed(2)} hours
                      </div>
                    </div>
                  </div>
                )}
                {stats.semiCrane.count > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="font-medium">Semi Crane</span>
                    <div className="text-right">
                      <div className="text-sm">
                        {stats.semiCrane.count} job
                        {stats.semiCrane.count !== 1 ? "s" : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {stats.semiCrane.hours.toFixed(2)} hours
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tolls Section */}
            {(stats.eastlink > 0 || stats.citylink > 0) && (
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                  Tolls
                </h3>
                <div className="space-y-2">
                  {stats.eastlink > 0 && (
                    <div className="flex justify-between items-center py-2 border-b">
                      <div>
                        <div className="font-medium">Eastlink</div>
                        <div className="text-xs text-muted-foreground">
                          {stats.eastlink} trip{stats.eastlink !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <span className="text-sm font-mono">
                        ${(stats.eastlink * 18.5).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {stats.citylink > 0 && (
                    <div className="flex justify-between items-center py-2 border-b">
                      <div>
                        <div className="font-medium">Citylink</div>
                        <div className="text-xs text-muted-foreground">
                          {stats.citylink} trip{stats.citylink !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <span className="text-sm font-mono">
                        ${(stats.citylink * 31).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Total Summary */}
            {/* TODO: Fetch toll rates from UI settings instead of hardcoded values ($18.50 for Eastlink, $31 for Citylink) */}
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total Jobs</span>
                <span className="text-lg font-bold">
                  {stats.tray.count +
                    stats.crane.count +
                    stats.semi.count +
                    stats.semiCrane.count}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="font-semibold">Total Hours</span>
                <span className="text-lg font-bold">
                  {(
                    stats.tray.hours +
                    stats.crane.hours +
                    stats.semi.hours +
                    stats.semiCrane.hours
                  ).toFixed(2)}
                </span>
              </div>
              {(stats.eastlink > 0 || stats.citylink > 0) && (
                <div className="flex justify-between items-center mt-2">
                  <span className="font-semibold">Total Tolls</span>
                  <span className="text-lg font-bold">
                    ${(stats.eastlink * 18.5 + stats.citylink * 31).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}, arePropsEqual);
