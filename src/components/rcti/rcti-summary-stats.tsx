import { CheckCircle, DollarSign, FileText, Lock } from "lucide-react";
import { SummaryStatCard } from "@/components/shared/summary-stat-card";

export interface RctiSummaryStatsProps {
  summaryStats: {
    total: number;
    draft: number;
    finalised: number;
    paid: number;
    totalAmount: number;
  };
}

export function RctiSummaryStats({ summaryStats }: RctiSummaryStatsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
      <SummaryStatCard
        label="Total RCTIs"
        value={summaryStats.total}
        subtitle="This period"
        icon={FileText}
      />
      <SummaryStatCard
        label="Draft"
        value={summaryStats.draft}
        subtitle="In progress"
        icon={FileText}
      />
      <SummaryStatCard
        label="Finalised"
        value={summaryStats.finalised}
        subtitle="Locked"
        icon={Lock}
      />
      <SummaryStatCard
        label="Paid"
        value={summaryStats.paid}
        subtitle="Completed"
        icon={CheckCircle}
      />
      <SummaryStatCard
        label="Total Amount"
        value={`$${summaryStats.totalAmount.toFixed(2)}`}
        subtitle="This period"
        icon={DollarSign}
      />
    </div>
  );
}
