"use client";

import Link from "next/link";
import { FilePlus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { createCustomerInvoice } from "@/hooks/use-customer-invoices";
import { queryKeys } from "@/lib/query-keys";
import type { Job } from "@/lib/types";

export interface CreateInvoiceBulkActionProps {
  jobs: Job[];
  /** Called once the invoice is created, e.g. to clear the row selection */
  onCreated: () => void;
}

/**
 * "Create invoice" for the jobs table's selected rows: saves the jobs as a
 * new customer invoice and links to its week on the invoices page. Hidden
 * without the manage_invoices permission.
 */
export function CreateInvoiceBulkAction({ jobs, onCreated }: CreateInvoiceBulkActionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { checkPermission } = usePermissions();
  const createInvoice = useMutation({
    mutationFn: createCustomerInvoice,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.customerInvoices.all }),
  });

  if (!checkPermission("manage_invoices")) return null;

  const handleCreate = async () => {
    try {
      const invoice = await createInvoice.mutateAsync({ jobIds: jobs.map((job) => job.id) });
      toast({
        title: "Invoice created",
        description: `${invoice.reference} created for ${invoice.customerName} with ${jobs.length} job${jobs.length === 1 ? "" : "s"}`,
        action: (
          <ToastAction altText="View invoices" asChild>
            <Link id="view-created-invoice-link" href={`/invoices?weekEnding=${invoice.weekEnding}`}>
              View invoices
            </Link>
          </ToastAction>
        ),
      });
      onCreated();
    } catch (error) {
      toast({
        title: "Could not create invoice",
        description: error instanceof Error && error.message ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      id="create-invoice-from-jobs-btn"
      variant="outline"
      size="sm"
      onClick={() => void handleCreate()}
      className="h-7 gap-1"
      type="button"
      disabled={createInvoice.isPending || jobs.length === 0}
    >
      <FilePlus className="h-3 w-3" aria-hidden="true" />
      Create invoice
    </Button>
  );
}
