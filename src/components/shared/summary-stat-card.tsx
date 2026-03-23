import { type LucideIcon } from "lucide-react";

export function SummaryStatCard({
  label,
  value,
  subtitle,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
}) {
  return (
    <div className="bg-muted/30 rounded-lg p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}
