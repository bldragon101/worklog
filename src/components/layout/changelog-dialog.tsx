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
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
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
  const [expandedTechnical, setExpandedTechnical] = React.useState<Set<string>>(
    new Set(),
  );

  React.useEffect(() => {
    // Expand the first version by default when dialog opens
    if (open && releases.length > 0) {
      setExpandedVersions(new Set([releases[0].version]));
    }
    // Reset technical details expansion when dialog opens
    setExpandedTechnical(new Set());
  }, [open, releases]);

  const toggleVersion = (version: string) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(version)) {
      newExpanded.delete(version);
      // Also collapse technical details when version is collapsed
      setExpandedTechnical((prev) => {
        const newTech = new Set(prev);
        newTech.delete(version);
        return newTech;
      });
    } else {
      newExpanded.add(version);
    }
    setExpandedVersions(newExpanded);
  };

  const toggleTechnical = (version: string) => {
    const newExpanded = new Set(expandedTechnical);
    if (newExpanded.has(version)) {
      newExpanded.delete(version);
    } else {
      newExpanded.add(version);
    }
    setExpandedTechnical(newExpanded);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Release History</DialogTitle>
          <DialogDescription>
            View changes and improvements in each version of WorkLog
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[calc(85vh-8rem)] pr-4">
          <div className="space-y-3">
            {releases.map((release, index) => {
              const isExpanded = expandedVersions.has(release.version);
              const isTechnicalExpanded = expandedTechnical.has(
                release.version,
              );
              const hasContent =
                release.features.length > 0 ||
                release.bugFixes.length > 0 ||
                release.breaking.length > 0;
              const hasTechnicalContent =
                release.features.length > 0 ||
                release.bugFixes.length > 0 ||
                release.breaking.length > 0;

              return (
                <div
                  key={release.version}
                  className="border rounded-lg p-3 overflow-hidden"
                >
                  <Button
                    variant="ghost"
                    onClick={() => toggleVersion(release.version)}
                    className="w-full justify-start p-0 h-auto hover:bg-transparent"
                    disabled={!hasContent && !release.userNotes}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {(hasContent || release.userNotes) &&
                        (isExpanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        ))}
                      {!hasContent && !release.userNotes && (
                        <div className="w-4" />
                      )}
                      <div className="flex items-center gap-3 flex-1 text-left">
                        <h3 className="text-lg font-semibold">
                          v{release.version}
                        </h3>
                        {release.url && (
                          <a
                            href={release.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
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

                  {isExpanded && (hasContent || release.userNotes) && (
                    <div className="mt-4 pl-6 pr-2 space-y-3 overflow-hidden">
                      {/* User-friendly notes if available */}
                      {release.userNotes && (
                        <>
                          {release.userNotes.whatsNew &&
                            release.userNotes.whatsNew.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium mb-2">
                                  What&apos;s New
                                </h4>
                                <ul className="space-y-1 text-sm text-muted-foreground">
                                  {release.userNotes.whatsNew.map((item, i) => (
                                    <li
                                      key={i}
                                      className="flex items-start gap-2"
                                    >
                                      <span className="mt-0.5 shrink-0">•</span>
                                      <span className="break-words">
                                        {item}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                          {release.userNotes.improvements &&
                            release.userNotes.improvements.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium mb-2">
                                  Improvements
                                </h4>
                                <ul className="space-y-1 text-sm text-muted-foreground">
                                  {release.userNotes.improvements.map(
                                    (item, i) => (
                                      <li
                                        key={i}
                                        className="flex items-start gap-2"
                                      >
                                        <span className="mt-0.5">•</span>
                                        <span>{item}</span>
                                      </li>
                                    ),
                                  )}
                                </ul>
                              </div>
                            )}
                        </>
                      )}

                      {/* Technical details expandable section */}
                      {hasTechnicalContent && (
                        <div className="border-t pt-3">
                          <Button
                            variant="ghost"
                            onClick={() => toggleTechnical(release.version)}
                            className="w-full justify-start p-0 h-auto hover:bg-transparent text-xs text-muted-foreground"
                          >
                            <div className="flex items-center gap-1">
                              {isTechnicalExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                              <span>Technical Details</span>
                            </div>
                          </Button>

                          {isTechnicalExpanded && (
                            <div className="mt-3 space-y-3 overflow-x-auto">
                              {release.breaking.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium mb-2 text-red-600 dark:text-red-400">
                                    Breaking Changes
                                  </h4>
                                  <ul className="space-y-1 text-sm text-muted-foreground">
                                    {release.breaking.map((item, i) => (
                                      <li
                                        key={i}
                                        className="flex items-start gap-2"
                                      >
                                        <span className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0">
                                          •
                                        </span>
                                        <span
                                          className="flex-1 break-all"
                                          style={{
                                            wordBreak: "break-word",
                                            overflowWrap: "anywhere",
                                          }}
                                        >
                                          {item.text}
                                          {item.commit && (
                                            <>
                                              {" "}
                                              <a
                                                href={item.commit.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                                onClick={(e) =>
                                                  e.stopPropagation()
                                                }
                                              >
                                                (
                                                {item.commit.hash.substring(
                                                  0,
                                                  7,
                                                )}
                                                )
                                              </a>
                                            </>
                                          )}
                                        </span>
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
                                      <li
                                        key={i}
                                        className="flex items-start gap-2"
                                      >
                                        <span className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0">
                                          •
                                        </span>
                                        <span
                                          className="flex-1 break-all"
                                          style={{
                                            wordBreak: "break-word",
                                            overflowWrap: "anywhere",
                                          }}
                                        >
                                          {feature.text}
                                          {feature.commit && (
                                            <>
                                              {" "}
                                              <a
                                                href={feature.commit.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                                onClick={(e) =>
                                                  e.stopPropagation()
                                                }
                                              >
                                                (
                                                {feature.commit.hash.substring(
                                                  0,
                                                  7,
                                                )}
                                                )
                                              </a>
                                            </>
                                          )}
                                        </span>
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
                                      <li
                                        key={i}
                                        className="flex items-start gap-2"
                                      >
                                        <span className="text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0">
                                          •
                                        </span>
                                        <span
                                          className="flex-1 break-all"
                                          style={{
                                            wordBreak: "break-word",
                                            overflowWrap: "anywhere",
                                          }}
                                        >
                                          {fix.text}
                                          {fix.commit && (
                                            <>
                                              {" "}
                                              <a
                                                href={fix.commit.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                                onClick={(e) =>
                                                  e.stopPropagation()
                                                }
                                              >
                                                (
                                                {fix.commit.hash.substring(
                                                  0,
                                                  7,
                                                )}
                                                )
                                              </a>
                                            </>
                                          )}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
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
