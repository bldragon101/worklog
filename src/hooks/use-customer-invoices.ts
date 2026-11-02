import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type {
  CustomerInvoicesWeekResponse,
  CustomerInvoiceView,
} from "@/lib/customer-invoices/types";

export interface CustomerInvoiceChanges {
  reference?: string;
  notes?: string | null;
  waivedBreakDeductions?: string[];
}

const JSON_HEADERS = { "Content-Type": "application/json" };

/** The saved invoices and automatic drafts for a week ending Sunday */
export function fetchCustomerInvoicesWeek({
  weekEnding,
}: {
  weekEnding: string;
}): Promise<CustomerInvoicesWeekResponse> {
  return fetchJson<CustomerInvoicesWeekResponse>({
    url: `/api/customer-invoices?weekEnding=${encodeURIComponent(weekEnding)}`,
    fallbackMessage: "Failed to load invoices",
  });
}

/** Save the given jobs as a new invoice, moving them off their current invoice */
export function createCustomerInvoice({
  jobIds,
  reference,
}: {
  jobIds: number[];
  reference?: string;
}): Promise<CustomerInvoiceView> {
  return fetchJson<CustomerInvoiceView>({
    url: "/api/customer-invoices",
    init: {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(reference ? { jobIds, reference } : { jobIds }),
    },
    fallbackMessage: "Failed to create invoice",
  });
}

/** Update a saved invoice's reference, notes or waived break deductions */
export function updateCustomerInvoice({
  id,
  changes,
}: {
  id: number;
  changes: CustomerInvoiceChanges;
}): Promise<CustomerInvoiceView> {
  return fetchJson<CustomerInvoiceView>({
    url: `/api/customer-invoices/${id}`,
    init: { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(changes) },
    fallbackMessage: "Failed to update invoice",
  });
}

/** Delete a saved invoice; its jobs return to the automatic draft */
export function deleteCustomerInvoice({ id }: { id: number }): Promise<{ success: true }> {
  return fetchJson<{ success: true }>({
    url: `/api/customer-invoices/${id}`,
    init: { method: "DELETE" },
    fallbackMessage: "Failed to delete invoice",
  });
}

/** Remove jobs from a saved invoice; the invoice is deleted when none are left */
export function removeCustomerInvoiceJobs({
  id,
  jobIds,
}: {
  id: number;
  jobIds: number[];
}): Promise<{ deleted: boolean; invoice: CustomerInvoiceView | null }> {
  return fetchJson<{ deleted: boolean; invoice: CustomerInvoiceView | null }>({
    url: `/api/customer-invoices/${id}/remove-jobs`,
    init: { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ jobIds }) },
    fallbackMessage: "Failed to remove jobs from invoice",
  });
}

/** The week's invoices, keeping the previous week on screen while a new week loads */
export function useCustomerInvoicesWeek({ weekEnding }: { weekEnding: string }) {
  return useQuery({
    queryKey: queryKeys.customerInvoices.week({ weekEnding }),
    queryFn: () => fetchCustomerInvoicesWeek({ weekEnding }),
    placeholderData: keepPreviousData,
  });
}

/**
 * Mutations for customer invoices. Each one refetches every invoice week once
 * it settles, since moving jobs changes both the source and target invoices.
 */
export function useCustomerInvoiceMutations() {
  const queryClient = useQueryClient();
  const onSettled = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.customerInvoices.all });

  const createInvoice = useMutation({ mutationFn: createCustomerInvoice, onSettled });
  const updateInvoice = useMutation({ mutationFn: updateCustomerInvoice, onSettled });
  const deleteInvoice = useMutation({ mutationFn: deleteCustomerInvoice, onSettled });
  const removeJobs = useMutation({ mutationFn: removeCustomerInvoiceJobs, onSettled });

  const isPending =
    createInvoice.isPending ||
    updateInvoice.isPending ||
    deleteInvoice.isPending ||
    removeJobs.isPending;

  return { createInvoice, updateInvoice, deleteInvoice, removeJobs, isPending };
}
