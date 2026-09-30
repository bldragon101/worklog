"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { JobsReport } from "@/lib/types";

export interface JobsReportNotesProps {
  report: JobsReport;
  editNotes: string;
  onEditNotesChange: ({ notes }: { notes: string }) => void;
  onSaveNotes: () => void;
  isSavingNotes: boolean;
}

/**
 * Editable notes for a draft report, read-only notes otherwise.
 */
export function JobsReportNotes({
  report,
  editNotes,
  onEditNotesChange,
  onSaveNotes,
  isSavingNotes,
}: JobsReportNotesProps) {
  return (
    <div className="p-5 border-b">
      <h4 className="text-sm font-semibold mb-2">Notes</h4>
      {report.status === "draft" ? (
        <div className="space-y-2">
          <Textarea
            id="jr-edit-notes"
            value={editNotes}
            onChange={(e) => onEditNotesChange({ notes: e.target.value })}
            placeholder="Add notes to this report..."
            rows={3}
            className="resize-none text-sm"
          />
          <Button
            type="button"
            id="jr-save-notes-btn"
            size="sm"
            variant="outline"
            onClick={() => onSaveNotes()}
            disabled={isSavingNotes || editNotes === (report.notes ?? "")}
          >
            {isSavingNotes ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              "Save Notes"
            )}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {report.notes ? (
            report.notes
          ) : (
            <span className="italic">No notes</span>
          )}
        </p>
      )}
    </div>
  );
}
