"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Release } from "@/lib/changelog";

interface ChangelogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  releases: Release[];
  currentVersion: string;
}

export function ChangelogDialog({
  open,
  onOpenChange,
  releases,
  currentVersion,
}: ChangelogDialogProps) {
  const [expandedVersions, setExpandedVersions] = React.useState<Set<string>>(
    new Set(),
  );

  React.useEffect(() => {
    // Expand the first version by default when dialog opens
    if (open && releases.length > 0) {
      setExpandedVersions(new Set([releases[0].version]));
    }
  }, [open, releases]);

  const toggleVersion = (version: string) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(version)) {
      newExpanded.delete(version);
    } else {
      newExpanded.add(version);
    }
    setExpandedVersions(newExpanded);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Release History</DialogTitle>
          <DialogDescription>
            View changes and improvements in each version of WorkLog
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-3">
            {releases.map((release, index) => {
              const isExpanded = expandedVersions.has(release.version);
              const hasContent =
                release.features.length > 0 ||
                release.bugFixes.length > 0 ||
                release.breaking.length > 0;

              return (
                <div key={release.version} className="border rounded-lg p-3">
                  <Button
                    variant="ghost"
                    onClick={() => toggleVersion(release.version)}
                    className="w-full justify-start p-0 h-auto hover:bg-transparent"
                    disabled={!hasContent}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {hasContent &&
                        (isExpanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        ))}
                      {!hasContent && <div className="w-4" />}
                      <div className="flex items-center gap-3 flex-1 text-left">
                        <h3 className="text-lg font-semibold">
                          v{release.version}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          {new Date(release.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </Badge>
                        {release.version === currentVersion && (
                          <Badge className="text-xs">Current</Badge>
                        )}
                        {index === 0 && release.version !== currentVersion && (
                          <Badge variant="secondary" className="text-xs">
                            Latest
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Button>

                  {isExpanded && hasContent && (
                    <div className="mt-4 pl-6 space-y-3">
                      {release.breaking.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 text-red-600 dark:text-red-400">
                            Breaking Changes
                          </h4>
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            {release.breaking.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-red-600 dark:text-red-400 mt-0.5">
                                  •
                                </span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {release.features.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 text-green-600 dark:text-green-400">
                            Features
                          </h4>
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            {release.features.map((feature, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-green-600 dark:text-green-400 mt-0.5">
                                  •
                                </span>
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {release.bugFixes.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 text-orange-600 dark:text-orange-400">
                            Bug Fixes
                          </h4>
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            {release.bugFixes.map((fix, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-orange-600 dark:text-orange-400 mt-0.5">
                                  •
                                </span>
                                <span>{fix}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
