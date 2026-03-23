import { Badge } from "@/components/ui/badge";

export function getStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "draft":
      return <Badge variant="secondary">Draft</Badge>;
    case "finalised":
      return <Badge variant="default">Finalised</Badge>;
    case "paid":
      return (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-100"
        >
          Paid
        </Badge>
      );
    default:
      return <Badge>{status}</Badge>;
  }
}
