import * as React from "react";

/**
 * Custom hook for managing job form attachment configuration and state
 * @param isOpen - Whether the form is open (triggers config fetching)
 * @returns Attachment configuration and dialog state
 */
export function useJobAttachments(isOpen: boolean) {
  const [isAttachmentDialogOpen, setIsAttachmentDialogOpen] =
    React.useState(false);
  const [attachmentConfig, setAttachmentConfig] = React.useState<{
    baseFolderId: string;
    driveId: string;
  } | null>(null);

  // Fetch Google Drive configuration for attachments from database
  React.useEffect(() => {
    if (!isOpen) return;

    const fetchAttachmentConfig = async () => {
      try {
        const response = await fetch(
          "/api/google-drive/settings?purpose=job_attachments",
        );
        const data = await response.json();

        if (response.ok && data.success && data.settings) {
          setAttachmentConfig({
            baseFolderId: data.settings.baseFolderId,
            driveId: data.settings.driveId,
          });
        }
      } catch (error) {
        console.error("Error fetching attachment config from database:", error);
      }
    };

    fetchAttachmentConfig();
  }, [isOpen]);

  return {
    isAttachmentDialogOpen,
    setIsAttachmentDialogOpen,
    attachmentConfig,
  };
}
