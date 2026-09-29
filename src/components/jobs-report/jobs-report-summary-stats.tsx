import { Briefcase, FileText, Lock } from "lucide-react";
import { SummaryStatCard } from "@/components/shared/summary-stat-card";

export interface JobsReportSummaryStatsProps {
  summaryStats: {
    total: number;
    draft: number;
    finalised: number;
    totalJobs: number;
  };
}

export function JobsReportSummaryStats({
  summaryStats,
}: JobsReportSummaryStatsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <SummaryStatCard
        label="Total Reports"
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
        label="Total Jobs"
        value={summaryStats.totalJobs}
        subtitle="Across all reports"
        icon={Briefcase}
      />
    </div>
  );
}
