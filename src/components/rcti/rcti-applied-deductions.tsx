import { Badge } from "@/components/ui/badge";
import type { Rcti } from "@/lib/types";

type DeductionApplication = NonNullable<Rcti["deductionApplications"]>[number];

const APPLIED_ROW_STYLES = {
  deduction: {
    text: "text-red-600 dark:text-red-400",
    amount: "font-medium text-red-600 dark:text-red-400",
    sign: "-",
  },
  reimbursement: {
    text: "text-green-600 dark:text-green-400",
    amount: "font-medium text-green-600 dark:text-green-400",
    sign: "+",
  },
} as const;

interface AppliedDeductionRowProps {
  app: DeductionApplication;
  kind: "deduction" | "reimbursement";
}

function AppliedDeductionRow({ app, kind }: AppliedDeductionRowProps) {
  const styles = APPLIED_ROW_STYLES[kind];
  const isSkipped = Number(app.amount) === 0;

  return (
    <div className="flex justify-between text-sm items-center">
      <span
        className={
          isSkipped ? "text-muted-foreground line-through" : styles.text
        }
      >
        {app.deduction.description}
      </span>
      <div className="flex items-center gap-2">
        <span
          className={
            isSkipped
              ? "font-medium text-muted-foreground line-through"
              : styles.amount
          }
        >
          {styles.sign}${Number(app.amount).toFixed(2)}
        </span>
        {isSkipped && (
          <Badge variant="secondary" className="text-xs">
            Skipped
          </Badge>
        )}
      </div>
    </div>
  );
}

export interface RctiAppliedDeductionsProps {
  deductionApplications: DeductionApplication[];
}

/**
 * Lists the deductions and reimbursements applied to a finalised or paid RCTI
 * with their net adjustment.
 */
export function RctiAppliedDeductions({
  deductionApplications,
}: RctiAppliedDeductionsProps) {
  const deductions = deductionApplications
    .filter((app) => app.deduction.type === "deduction")
    .reduce((sum, app) => sum + Number(app.amount), 0);
  const reimbursements = deductionApplications
    .filter((app) => app.deduction.type === "reimbursement")
    .reduce((sum, app) => sum + Number(app.amount), 0);
  const net = reimbursements - deductions;

  return (
    <div className="p-3 border rounded-lg bg-muted/50">
      <h4 className="font-medium text-sm mb-2 text-foreground">
        Deductions Applied to this RCTI:
      </h4>
      <div className="space-y-2">
        {deductionApplications
          .filter((app) => app.deduction.type === "deduction")
          .map((app) => (
            <AppliedDeductionRow key={app.id} app={app} kind="deduction" />
          ))}
        {deductionApplications
          .filter((app) => app.deduction.type === "reimbursement")
          .map((app) => (
            <AppliedDeductionRow key={app.id} app={app} kind="reimbursement" />
          ))}
        <div className="pt-2 border-t border-border flex justify-between text-sm font-semibold text-foreground">
          <span>Net Adjustment:</span>
          <span>{`${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`}</span>
        </div>
      </div>
    </div>
  );
}
