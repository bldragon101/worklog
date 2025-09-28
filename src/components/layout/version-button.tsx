"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { ChangelogDialog } from "./changelog-dialog";
import type { Release } from "@/lib/changelog";

interface VersionButtonProps {
  releases: Release[];
  currentVersion: string;
}

export function VersionButton({
  releases,
  currentVersion,
}: VersionButtonProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [dialogOpen, setDialogOpen] = React.useState(false);

  if (isCollapsed) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="default"
        onClick={() => setDialogOpen(true)}
        className="h-9 px-3 text-sm font-medium rounded"
      >
        v{currentVersion}
      </Button>
      <ChangelogDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        releases={releases}
        currentVersion={currentVersion}
      />
    </>
  );
}
