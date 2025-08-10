"use client"

import * as React from "react"
import { Column } from "@tanstack/react-table"
import { PlusCircle, X } from "lucide-react"
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

export function DataTableFacetedFilterSimple<TData, TValue>({
  column,
  title,
  options,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const facets = column?.getFacetedUniqueValues()
  
  // Get current filter values directly from the column
  const getCurrentValues = React.useCallback((): string[] => {
    const filterValue = column?.getFilterValue()
    if (Array.isArray(filterValue)) {
      return filterValue.map(String)
    }
    if (filterValue !== undefined && filterValue !== null) {
      return [String(filterValue)]
    }
    return []
  }, [column])
  
  const [selectedValues, setSelectedValues] = React.useState<string[]>(() => getCurrentValues())
  
  // Sync local state with column filter value
  React.useEffect(() => {
    setSelectedValues(getCurrentValues())
  }, [column, getCurrentValues])
  
  const handleCheckboxChange = (optionValue: string, checked: boolean) => {
    let newValues: string[]
    
    if (checked) {
      newValues = [...selectedValues, optionValue]
    } else {
      newValues = selectedValues.filter(val => val !== optionValue)
    }
    
    setSelectedValues(newValues)
    column?.setFilterValue(newValues.length > 0 ? newValues : undefined)
  }

  const handleClearAll = () => {
    setSelectedValues([])
    column?.setFilterValue(undefined)
  }

  return (
    <div className="flex items-center space-x-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 border-dashed">
            <PlusCircle className="mr-2 h-4 w-4" />
            {title}
            {selectedValues.length > 0 && (
              <>
                <Badge
                  variant="secondary"
                  className="rounded-sm px-1 font-normal lg:hidden"
                >
                  {selectedValues.length}
                </Badge>
                <div className="hidden space-x-1 lg:flex">
                  {selectedValues.length > 3 ? (
                    <Badge
                      variant="secondary"
                      className="rounded-sm px-1 font-normal"
                    >
                      {selectedValues.length} selected
                    </Badge>
                  ) : (
                    options
                      .filter((option) => selectedValues.includes(option.value))
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
              const isSelected = selectedValues.includes(option.value)
              const count = facets?.get(option.value)
              
              return (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`filter-${title}-${option.value}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      handleCheckboxChange(option.value, checked === true)
                    }}
                  />
                  <Label
                    htmlFor={`filter-${title}-${option.value}`}
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
          {selectedValues.length > 0 && (
            <div className="pt-3 mt-3 border-t">
              <Button
                variant="ghost"
                onClick={handleClearAll}
                className="w-full h-8 text-sm"
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
    {selectedValues.length > 0 && (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={handleClearAll}
        title={`Clear ${title} filter`}
      >
        <X className="h-4 w-4" />
      </Button>
    )}
  </div>
  )
}