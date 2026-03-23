import { Badge } from "@/components/ui/badge";

export function SentBadge({ sentAt }: { sentAt?: string | null }) {
  if (!sentAt) return null;

  return (
    <Badge
      variant="outline"
      className="bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900 dark:text-sky-100 dark:border-sky-800"
    >
      Sent
    </Badge>
  );
}
