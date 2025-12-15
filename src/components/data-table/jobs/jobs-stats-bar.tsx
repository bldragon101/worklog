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

import { BarChart3 } from "lucide-react";

// Toll rates (TODO: Fetch from UI settings instead of hardcoded values)
const TOLL_RATE_EASTLINK = 18.5;
const TOLL_RATE_CITYLINK = 31;

// StatItem component moved outside to fix react-hooks/static-components error
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

export function JobsStatsBar({ table }: JobsStatsBarProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [showCompact, setShowCompact] = React.useState(false);

  // Calculate stats directly from filtered rows during render
  const filteredRows = table.getFilteredRowModel().rows;

  const calculatedStats = React.useMemo(() => {
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
      // Split into words for precise matching to avoid false positives
      const truckWords = truckType.split(/\s+/);

      // Check for "SEMI CRANE" first (most specific)
      if (truckWords.includes("SEMI") && truckWords.includes("CRANE")) {
        result.semiCrane.count++;
        result.semiCrane.hours += hours;
      }
      // Check for "CRANE" only (not with "SEMI")
      else if (truckWords.includes("CRANE") && !truckWords.includes("SEMI")) {
        result.crane.count++;
        result.crane.hours += hours;
      }
      // Check for "SEMI" only (not with "CRANE")
      else if (truckWords.includes("SEMI") && !truckWords.includes("CRANE")) {
        result.semi.count++;
        result.semi.hours += hours;
      }
      // Check for "TRAY" only (not with "CRANE" or "SEMI")
      else if (
        truckWords.includes("TRAY") &&
        !truckWords.includes("CRANE") &&
        !truckWords.includes("SEMI")
      ) {
        result.tray.count++;
        result.tray.hours += hours;
      }

      // Sum tolls
      result.eastlink += job.eastlink || 0;
      result.citylink += job.citylink || 0;
    });

    return result;
  }, [filteredRows]);

  // Check if we should show compact view
  React.useEffect(() => {
    const checkWidth = () => {
      setShowCompact(window.innerWidth < 1200);
    };

    checkWidth();
    window.addEventListener("resize", checkWidth);

    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  const hasAnyStats =
    calculatedStats.tray.count > 0 ||
    calculatedStats.crane.count > 0 ||
    calculatedStats.semi.count > 0 ||
    calculatedStats.semiCrane.count > 0 ||
    calculatedStats.eastlink > 0 ||
    calculatedStats.citylink > 0;

  return (
    <>
      {hasAnyStats && (
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
              <div
                className="flex gap-3 items-center cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setIsDialogOpen(true)}
                title="Click to view detailed stats"
              >
                {calculatedStats.tray.count > 0 && (
                  <StatItem
                    label="TT"
                    value={`${calculatedStats.tray.count} - ${calculatedStats.tray.hours.toFixed(2)}h`}
                  />
                )}
                {calculatedStats.tray.count > 0 &&
                  calculatedStats.crane.count > 0 && (
                    <div className="h-6 w-px bg-border" />
                  )}
                {calculatedStats.crane.count > 0 && (
                  <StatItem
                    label="CT"
                    value={`${calculatedStats.crane.count} - ${calculatedStats.crane.hours.toFixed(2)}h`}
                  />
                )}
                {calculatedStats.crane.count > 0 &&
                  calculatedStats.semi.count > 0 && (
                    <div className="h-6 w-px bg-border" />
                  )}
                {calculatedStats.semi.count > 0 && (
                  <StatItem
                    label="ST"
                    value={`${calculatedStats.semi.count} - ${calculatedStats.semi.hours.toFixed(2)}h`}
                  />
                )}
                {calculatedStats.semi.count > 0 &&
                  calculatedStats.semiCrane.count > 0 && (
                    <div className="h-6 w-px bg-border" />
                  )}
                {calculatedStats.semiCrane.count > 0 && (
                  <StatItem
                    label="SCT"
                    value={`${calculatedStats.semiCrane.count} - ${calculatedStats.semiCrane.hours.toFixed(2)}h`}
                  />
                )}
                {(calculatedStats.semiCrane.count > 0 ||
                  calculatedStats.semi.count > 0 ||
                  calculatedStats.crane.count > 0 ||
                  calculatedStats.tray.count > 0) &&
                  (calculatedStats.eastlink > 0 ||
                    calculatedStats.citylink > 0) && (
                    <div className="h-6 w-px bg-border mx-1" />
                  )}
                {calculatedStats.eastlink > 0 && (
                  <StatItem label="EL" value={`${calculatedStats.eastlink}`} />
                )}
                {calculatedStats.eastlink > 0 &&
                  calculatedStats.citylink > 0 && (
                    <div className="h-6 w-px bg-border" />
                  )}
                {calculatedStats.citylink > 0 && (
                  <StatItem label="CL" value={`${calculatedStats.citylink}`} />
                )}
              </div>
            </div>
          )}
        </div>
      )}

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
                {calculatedStats.tray.count > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="font-medium">Tray</span>
                    <div className="text-right">
                      <div className="text-sm">
                        {calculatedStats.tray.count} job
                        {calculatedStats.tray.count !== 1 ? "s" : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {calculatedStats.tray.hours.toFixed(2)} hours
                      </div>
                    </div>
                  </div>
                )}
                {calculatedStats.crane.count > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="font-medium">Crane</span>
                    <div className="text-right">
                      <div className="text-sm">
                        {calculatedStats.crane.count} job
                        {calculatedStats.crane.count !== 1 ? "s" : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {calculatedStats.crane.hours.toFixed(2)} hours
                      </div>
                    </div>
                  </div>
                )}
                {calculatedStats.semi.count > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="font-medium">Semi</span>
                    <div className="text-right">
                      <div className="text-sm">
                        {calculatedStats.semi.count} job
                        {calculatedStats.semi.count !== 1 ? "s" : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {calculatedStats.semi.hours.toFixed(2)} hours
                      </div>
                    </div>
                  </div>
                )}
                {calculatedStats.semiCrane.count > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="font-medium">Semi Crane</span>
                    <div className="text-right">
                      <div className="text-sm">
                        {calculatedStats.semiCrane.count} job
                        {calculatedStats.semiCrane.count !== 1 ? "s" : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {calculatedStats.semiCrane.hours.toFixed(2)} hours
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tolls Section */}
            {(calculatedStats.eastlink > 0 || calculatedStats.citylink > 0) && (
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                  Tolls
                </h3>
                <div className="space-y-2">
                  {calculatedStats.eastlink > 0 && (
                    <div className="flex justify-between items-center py-2 border-b">
                      <div>
                        <div className="font-medium">Eastlink</div>
                        <div className="text-xs text-muted-foreground">
                          {calculatedStats.eastlink} trip
                          {calculatedStats.eastlink !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <span className="text-sm font-mono">
                        $
                        {(
                          calculatedStats.eastlink * TOLL_RATE_EASTLINK
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {calculatedStats.citylink > 0 && (
                    <div className="flex justify-between items-center py-2 border-b">
                      <div>
                        <div className="font-medium">Citylink</div>
                        <div className="text-xs text-muted-foreground">
                          {calculatedStats.citylink} trip
                          {calculatedStats.citylink !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <span className="text-sm font-mono">
                        $
                        {(
                          calculatedStats.citylink * TOLL_RATE_CITYLINK
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Total Summary */}
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total Jobs</span>
                <span className="text-lg font-bold">
                  {calculatedStats.tray.count +
                    calculatedStats.crane.count +
                    calculatedStats.semi.count +
                    calculatedStats.semiCrane.count}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="font-semibold">Total Hours</span>
                <span className="text-lg font-bold">
                  {(
                    calculatedStats.tray.hours +
                    calculatedStats.crane.hours +
                    calculatedStats.semi.hours +
                    calculatedStats.semiCrane.hours
                  ).toFixed(2)}
                </span>
              </div>
              {(calculatedStats.eastlink > 0 ||
                calculatedStats.citylink > 0) && (
                <div className="flex justify-between items-center mt-2">
                  <span className="font-semibold">Total Tolls</span>
                  <span className="text-lg font-bold">
                    $
                    {(
                      calculatedStats.eastlink * TOLL_RATE_EASTLINK +
                      calculatedStats.citylink * TOLL_RATE_CITYLINK
                    ).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
