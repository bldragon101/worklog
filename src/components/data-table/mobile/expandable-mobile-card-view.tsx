"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreHorizontal, Edit, Trash2, ChevronDown, ChevronUp, Paperclip } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MobileCardField {
  key: string;
  label: string;
  render?: (value: unknown, item: unknown) => React.ReactNode;
  className?: string;
  isBadge?: boolean;
  isTitle?: boolean;
  isSubtitle?: boolean;
  isCheckbox?: boolean;
  onCheckboxChange?: (item: unknown, value: boolean) => void;
}

interface ExpandableDetailField {
  key: string;
  label: string;
  render?: (value: unknown, item: unknown) => React.ReactNode;
  className?: string;
  isBadge?: boolean;
  hideIfEmpty?: boolean;
}

interface ExpandableMobileCardViewProps<T> {
  data: T[];
  fields: MobileCardField[];
  expandableFields: ExpandableDetailField[];
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onAttachFiles?: (item: T) => void;
  isLoading?: boolean;
  loadingRowId?: number | null;
  getItemId?: (item: T) => number | string;
}

function MobileCardSkeleton() {
  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-5 bg-muted rounded animate-pulse w-2/3"></div>
            <div className="h-8 w-8 bg-muted rounded animate-pulse"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded animate-pulse w-1/2"></div>
            <div className="h-4 bg-muted rounded animate-pulse w-3/4"></div>
            <div className="h-4 bg-muted rounded animate-pulse w-1/3"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ExpandableMobileCardView<T>({
  data,
  fields,
  expandableFields,
  onEdit,
  onDelete,
  onAttachFiles,
  isLoading = false,
  loadingRowId,
  getItemId,
}: ExpandableMobileCardViewProps<T>) {
  const [expandedCards, setExpandedCards] = useState<Set<string | number>>(new Set());

  const toggleCardExpansion = (itemId: string | number) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <MobileCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">No results found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const itemId = getItemId ? getItemId(item) : index;
        const isItemLoading = loadingRowId === itemId;
        const isExpanded = expandedCards.has(itemId);
        
        // Separate checkbox fields from regular fields
        const checkboxFields = fields.filter(field => field.isCheckbox);
        const regularFields = fields.filter(field => !field.isCheckbox);
        
        return (
          <Card 
            key={itemId}
            className={`transition-all duration-200 cursor-pointer hover:shadow-md ${
              isItemLoading ? 'opacity-50' : ''
            }`}
          >
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Header with title/subtitle and action menu */}
                <div 
                  className="flex items-start justify-between gap-3"
                  onClick={() => !isItemLoading && toggleCardExpansion(itemId)}
                >
                  <div className="flex-1 space-y-1 min-w-0">
                    {regularFields.filter(field => field.isTitle || field.isSubtitle).map((field) => {
                      const value = (item as Record<string, unknown>)[field.key];
                      
                      if (value === undefined || value === null || value === '') {
                        return null;
                      }

                      let renderedValue: React.ReactNode;
                      
                      if (field.render) {
                        renderedValue = field.render(value, item);
                      } else if (field.isBadge) {
                        renderedValue = (
                          <Badge variant="outline" className="text-xs">
                            {String(value)}
                          </Badge>
                        );
                      } else {
                        renderedValue = String(value);
                      }

                      if (field.isTitle) {
                        return (
                          <h3 key={field.key} className="font-semibold text-base truncate">
                            {renderedValue}
                          </h3>
                        );
                      }

                      if (field.isSubtitle) {
                        return (
                          <p key={field.key} className="text-sm text-muted-foreground truncate">
                            {renderedValue}
                          </p>
                        );
                      }

                      return null;
                    })}
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Expand/Collapse indicator */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={isItemLoading}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    
                    {/* Action menu */}
                    {(onEdit || onDelete || onAttachFiles) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={isItemLoading}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onEdit && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(item);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {onAttachFiles && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onAttachFiles(item);
                              }}
                            >
                              <Paperclip className="mr-2 h-4 w-4" />
                              Attach Files
                            </DropdownMenuItem>
                          )}
                          {onDelete && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(item);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                {/* Body with regular fields and checkboxes */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2 min-w-0">
                    {regularFields.filter(field => !field.isTitle && !field.isSubtitle).map((field) => {
                      const value = (item as Record<string, unknown>)[field.key];
                      
                      if (value === undefined || value === null || value === '') {
                        return null;
                      }

                      let renderedValue: React.ReactNode;
                      
                      if (field.render) {
                        renderedValue = field.render(value, item);
                      } else if (field.isBadge) {
                        renderedValue = (
                          <Badge variant="outline" className="text-xs">
                            {String(value)}
                          </Badge>
                        );
                      } else {
                        renderedValue = String(value);
                      }

                      return (
                        <div key={field.key} className={`text-sm ${field.className || ''}`}>
                          <span className="text-muted-foreground mr-2">
                            {field.label}:
                          </span>
                          <span>{renderedValue}</span>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Checkboxes on the right */}
                  {checkboxFields.length > 0 && (
                    <div className="flex-shrink-0 space-y-2">
                      {checkboxFields.map((field) => {
                        const value = (item as Record<string, unknown>)[field.key];
                        return (
                          <div key={field.key} className="flex items-center justify-end gap-2">
                            <label 
                              htmlFor={`${itemId}-${field.key}`} 
                              className="text-sm font-medium text-foreground cursor-pointer select-none text-right"
                            >
                              {field.label}
                            </label>
                            <Checkbox
                              id={`${itemId}-${field.key}`}
                              checked={Boolean(value)}
                              onCheckedChange={(checked) => {
                                if (field.onCheckboxChange && !isItemLoading) {
                                  field.onCheckboxChange(item, Boolean(checked));
                                }
                              }}
                              disabled={isItemLoading}
                              onClick={(e) => e.stopPropagation()}
                              className="h-5 w-5 rounded-md border-2 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Expanded details section */}
                {isExpanded && (
                  <div className="border-t pt-3 mt-3">
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-foreground mb-2">Additional Details</h4>
                      <div className="grid gap-2">
                        {expandableFields.map((field) => {
                          const value = (item as Record<string, unknown>)[field.key];
                          
                          // Hide field if empty and hideIfEmpty is true
                          if (field.hideIfEmpty && (value === undefined || value === null || value === '')) {
                            return null;
                          }

                          let renderedValue: React.ReactNode;
                          
                          if (field.render) {
                            renderedValue = field.render(value, item);
                          } else if (field.isBadge) {
                            renderedValue = (
                              <Badge variant="outline" className="text-xs">
                                {String(value) || "N/A"}
                              </Badge>
                            );
                          } else {
                            renderedValue = String(value) || "N/A";
                          }

                          return (
                            <div key={field.key} className={`text-sm ${field.className || ''}`}>
                              <span className="text-muted-foreground mr-2 font-medium">
                                {field.label}:
                              </span>
                              <span>{renderedValue}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}