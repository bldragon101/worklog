import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { jobAttachmentDriveSettingsQuery } from "@/lib/queries";

/**
 * Custom hook for managing job form attachment configuration and state
 * @param isOpen - Whether the form is open (triggers config fetching)
 * @returns Attachment configuration and dialog state
 */
export function useJobAttachments({ isOpen }: { isOpen: boolean }) {
  const [isAttachmentDialogOpen, setIsAttachmentDialogOpen] =
    React.useState(false);

  // Google Drive configuration for attachments from the database
  const { data: attachmentConfig = null } = useQuery({
    ...jobAttachmentDriveSettingsQuery,
    enabled: isOpen,
    select: (settings) =>
      settings
        ? { baseFolderId: settings.baseFolderId, driveId: settings.driveId }
        : null,
  });

  return {
    isAttachmentDialogOpen,
    setIsAttachmentDialogOpen,
    attachmentConfig,
  };
}
