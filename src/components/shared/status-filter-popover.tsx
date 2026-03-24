import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PlusCircle, X } from "lucide-react";

interface StatusOption {
  value: string;
  label: string;
}

export function StatusFilterPopover({
  statuses,
  statusFilter,
  onStatusChange,
  idPrefix = "filter",
}: {
  statuses: StatusOption[];
  statusFilter: string;
  onStatusChange: ({ status }: { status: string }) => void;
  idPrefix?: string;
}) {
  const activeLabel = statuses.find((s) => s.value === statusFilter)?.label;
  const clearStatusIconTitleId = `${idPrefix}-clear-status-filter-icon-title`;
  const handleStatusChange = ({ status }: { status: string }) =>
    onStatusChange({ status });

  return (
    <div className="flex items-center space-x-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-dashed rounded"
            id={`${idPrefix}-status-filter-btn`}
          >
            <PlusCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            Status
            {statusFilter !== "all" && activeLabel && (
              <span className="inline-flex items-center border py-0.5 text-xs border-transparent bg-secondary text-secondary-foreground rounded px-1 font-normal ml-2">
                {activeLabel}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[180px] p-0" align="start">
          <div className="p-3">
            <div className="grid gap-2">
              {statuses.map((s) => (
                <div
                  key={s.value}
                  id={`status-option-${String(s.value).toLowerCase().replace(/\s+/g, "-")}`}
                  role="button"
                  tabIndex={0}
                  className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                  onClick={() => handleStatusChange({ status: s.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleStatusChange({ status: s.value });
                    }
                  }}
                >
                  <Checkbox
                    id={`${idPrefix}-status-${s.value}`}
                    checked={statusFilter === s.value}
                    className="rounded-none data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <Label
                    htmlFor={`${idPrefix}-status-${s.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {s.label}
                  </Label>
                </div>
              ))}
            </div>
            {statusFilter !== "all" && (
              <div className="pt-3 mt-3 border-t">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onStatusChange({ status: "all" })}
                  className="w-full h-8 text-sm"
                >
                  Clear filter
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {statusFilter !== "all" && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          id={`${idPrefix}-clear-status-filter-btn`}
          title="Clear status filter"
          onClick={() => onStatusChange({ status: "all" })}
          onKeyUp={(e) => {
            if (e.key === "Enter" || e.key === " ")
              onStatusChange({ status: "all" });
          }}
        >
          <X
            className="h-4 w-4"
            role="img"
            aria-labelledby={clearStatusIconTitleId}
          >
            <title id={clearStatusIconTitleId}>Clear filters</title>
          </X>
        </Button>
      )}
    </div>
  );
}
