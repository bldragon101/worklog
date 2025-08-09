"use client"

import * as React from "react"
import { Column } from "@tanstack/react-table"
import { PlusCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>
  title?: string
  options: {
    label: string
    value: string
    icon?: React.ComponentType<{ className?: string }>
  }[]
}

export function DataTableFacetedFilterFixed<TData, TValue>({
  column,
  title,
  options,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const facets = column?.getFacetedUniqueValues()
  const filterValue = column?.getFilterValue()
  
  // Use a more reliable way to get selected values
  const selectedValues = React.useMemo(() => {
    const currentValue = column?.getFilterValue()
    if (Array.isArray(currentValue)) {
      return new Set(currentValue.map(String))
    }
    if (currentValue !== undefined && currentValue !== null) {
      return new Set([String(currentValue)])
    }
    return new Set<string>()
  }, [column?.getFilterValue()])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <PlusCircle className="mr-2 h-4 w-4" />
          {title}
          {selectedValues?.size > 0 && (
            <>
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selectedValues.size}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                {selectedValues.size > 3 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {selectedValues.size} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => (
                      <Badge
                        variant="secondary"
                        key={option.value}
                        className="rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <div className="max-h-[300px] overflow-y-auto p-3">
          <div className="grid gap-2">
            {options.map((option) => {
              const isSelected = selectedValues.has(option.value)
              const count = facets?.get(option.value)
              
              return (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    key={`${option.value}-${isSelected}`}
                    id={`filter-${option.value}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      const currentFilterValue = column?.getFilterValue()
                      const currentValues = Array.isArray(currentFilterValue) 
                        ? currentFilterValue.map(String)
                        : currentFilterValue !== undefined && currentFilterValue !== null 
                          ? [String(currentFilterValue)]
                          : []
                      
                      let newValues: string[]
                      
                      if (checked) {
                        newValues = [...currentValues, option.value]
                      } else {
                        newValues = currentValues.filter((val) => val !== option.value)
                      }
                      
                      column?.setFilterValue(newValues.length > 0 ? newValues : undefined)
                    }}
                  />
                  <Label
                    htmlFor={`filter-${option.value}`}
                    className="flex flex-1 items-center justify-between text-sm font-normal cursor-pointer"
                  >
                    <span className="flex items-center">
                      {option.icon && (
                        <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      )}
                      {option.label}
                    </span>
                    {count && (
                      <span className="ml-auto font-mono text-xs text-muted-foreground">
                        {count}
                      </span>
                    )}
                  </Label>
                </div>
              )
            })}
          </div>
          {selectedValues.size > 0 && (
            <div className="pt-3 mt-3 border-t">
              <Button
                variant="ghost"
                onClick={() => column?.setFilterValue(undefined)}
                className="w-full h-8 text-sm"
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}