import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PlusCircle, X } from "lucide-react";
import type { Driver } from "@/lib/types";

interface DriverGroup {
  label: string;
  drivers: Driver[];
}

export function DriverFilterPopover({
  driverGroups,
  selectedDriverIds,
  totalDriverCount,
  onToggleDriver,
  onSelectAll,
  onClear,
  idPrefix = "filter",
  allDrivers,
}: {
  driverGroups: DriverGroup[];
  selectedDriverIds: string[];
  totalDriverCount: number;
  onToggleDriver: ({ driverId }: { driverId: string }) => void;
  onSelectAll: () => void;
  onClear: () => void;
  idPrefix?: string;
  allDrivers: Driver[];
}) {
  return (
    <div className="flex items-center space-x-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-dashed rounded"
            id={`${idPrefix}-driver-filter-btn`}
          >
            <PlusCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            Driver
            {selectedDriverIds.length > 0 && (
              <div className="flex space-x-1 ml-1">
                {selectedDriverIds.length > 2 ? (
                  <span className="inline-flex items-center border py-0.5 text-xs border-transparent bg-secondary text-secondary-foreground rounded px-1 font-normal">
                    {selectedDriverIds.length} selected
                  </span>
                ) : (
                  selectedDriverIds.map((driverId) => {
                    const driver = allDrivers.find(
                      (d) => d.id.toString() === driverId,
                    );
                    return (
                      <span
                        key={driverId}
                        className="inline-flex items-center border py-0.5 text-xs border-transparent bg-secondary text-secondary-foreground rounded px-1 font-normal"
                      >
                        {driver?.driver ?? driverId}
                      </span>
                    );
                  })
                )}
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <div className="max-h-[400px] overflow-y-auto p-3">
            <div className="grid gap-2">
              <div className="flex items-center space-x-2 pb-2 border-b">
                <Checkbox
                  id={`${idPrefix}-select-all-drivers`}
                  checked={
                    totalDriverCount > 0 &&
                    selectedDriverIds.length === totalDriverCount
                  }
                  onCheckedChange={onSelectAll}
                  className="rounded-none data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label
                  htmlFor={`${idPrefix}-select-all-drivers`}
                  className="flex flex-1 items-center justify-between text-sm font-semibold cursor-pointer"
                >
                  Select All
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {selectedDriverIds.length}/{totalDriverCount}
                  </span>
                </Label>
              </div>

              {driverGroups.map(
                (group) =>
                  group.drivers.length > 0 && (
                    <div key={group.label}>
                      <div className="text-xs font-bold text-primary uppercase tracking-wide mt-2">
                        {group.label}
                      </div>
                      {group.drivers.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center space-x-2 mt-2"
                        >
                          <Checkbox
                            id={`${idPrefix}-driver-${d.id}`}
                            checked={selectedDriverIds.includes(
                              d.id.toString(),
                            )}
                            onCheckedChange={() =>
                              onToggleDriver({ driverId: d.id.toString() })
                            }
                            className="rounded-none data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                          <Label
                            htmlFor={`${idPrefix}-driver-${d.id}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {d.driver}
                          </Label>
                        </div>
                      ))}
                    </div>
                  ),
              )}
            </div>

            {selectedDriverIds.length > 0 && (
              <div className="pt-3 mt-3 border-t">
                <Button
                  type="button"
                  variant="ghost"
                  id={`${idPrefix}-clear-filters-btn`}
                  onClick={onClear}
                  className="w-full h-8 text-sm"
                >
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selectedDriverIds.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          id={`${idPrefix}-clear-driver-filter-btn`}
          title="Clear driver filter"
          onClick={onClear}
          onKeyUp={(e) => {
            if (e.key === "Enter" || e.key === " ") onClear();
          }}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
