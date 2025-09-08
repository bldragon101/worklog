"use client";

import React, { useState, useEffect, useCallback } from "react";
import { UnifiedDataTable } from "@/components/data-table/core/unified-data-table";
import { CustomerForm } from "@/components/entities/customer/customer-form";
import { Customer } from "@/lib/types";
import { customerColumns } from "@/components/entities/customer/customer-columns";
import { customerSheetFields } from "@/components/entities/customer/customer-sheet-fields";
import { CustomerDataTableToolbarWrapper } from "@/components/entities/customer/customer-data-table-toolbar-wrapper";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { PageControls } from "@/components/layout/page-controls";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ProgressDialog } from "@/components/ui/progress-dialog";
import { TableLoadingSkeleton } from "@/components/ui/table-loading-skeleton";
import { useToast } from "@/hooks/use-toast";

const CustomersPage = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingRowId, setLoadingRowId] = useState<number | null>(null);

  // Multi-delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customersToDelete, setCustomersToDelete] = useState<Customer[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const { toast } = useToast();

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/customers");
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      } else {
        console.error("Failed to fetch customers");
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Handle form submission
  const handleFormSubmit = async (customerData: Partial<Customer>) => {
    try {
      setIsSubmitting(true);

      if (editingCustomer) {
        // Update existing customer
        const response = await fetch(`/api/customers/${editingCustomer.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(customerData),
        });

        if (response.ok) {
          await fetchCustomers();
          setIsFormOpen(false);
          setEditingCustomer(null);
        } else {
          console.error("Failed to update customer");
        }
      } else {
        // Create new customer
        const response = await fetch("/api/customers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(customerData),
        });

        if (response.ok) {
          await fetchCustomers();
          setIsFormOpen(false);
        } else {
          console.error("Failed to create customer");
        }
      }
    } catch (error) {
      console.error("Error submitting customer:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit
  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsFormOpen(true);
  };

  // Handle delete
  const handleDelete = async (customer: Customer) => {
    setLoadingRowId(customer.id);
    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchCustomers();
      } else {
        const errorData = await response.json();
        console.error("Failed to delete customer:", errorData.error);
        throw new Error(errorData.error || "Failed to delete customer");
      }
    } catch (error) {
      console.error("Error deleting customer:", error);
      throw error; // Re-throw to let the dialog handle the error
    } finally {
      setLoadingRowId(null);
    }
  };

  // Multi-delete handler
  const handleMultiDelete = useCallback(async (selected: Customer[]) => {
    setCustomersToDelete(selected);
    setDeleteDialogOpen(true);
  }, []);

  // Confirm multi-delete
  const confirmDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      // Delete customers in parallel
      const results = await Promise.all(
        customersToDelete.map((customer) =>
          fetch(`/api/customers/${customer.id}`, { method: "DELETE" }),
        ),
      );
      const allOk = results.every((res) => res.ok);

      if (allOk) {
        toast({
          title: "Customers deleted successfully",
          description: `${customersToDelete.length} customer${customersToDelete.length === 1 ? "" : "s"} deleted`,
          variant: "default",
        });
      } else {
        toast({
          title: "Some deletions failed",
          description: "Please refresh and try again",
          variant: "destructive",
        });
      }
      setDeleteDialogOpen(false);
      setCustomersToDelete([]);
      await fetchCustomers();
    } catch (error) {
      console.error("Error deleting customers:", error);
      toast({
        title: "Error deleting customers",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [customersToDelete, toast]);

  // Handle add new customer
  const handleAddNew = () => {
    setEditingCustomer(null);
    setIsFormOpen(true);
  };

  // Handle form close
  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingCustomer(null);
  };

  // Mobile card fields configuration
  const customerMobileFields = [
    {
      key: "customer",
      label: "Customer",
      isTitle: true,
    },
    {
      key: "billTo",
      label: "Bill To",
      isSubtitle: true,
    },
    {
      key: "fuelLevy",
      label: "Fuel Levy",
      render: (value: unknown) =>
        value ? `${(value as number).toFixed(2)}%` : null,
    },
    {
      key: "tray",
      label: "Tray Rate",
      render: (value: unknown) =>
        value ? `$${(value as number).toFixed(2)}` : null,
    },
    {
      key: "crane",
      label: "Crane Rate",
      render: (value: unknown) =>
        value ? `$${(value as number).toFixed(2)}` : null,
    },
    {
      key: "semi",
      label: "Semi Rate",
      render: (value: unknown) =>
        value ? `$${(value as number).toFixed(2)}` : null,
    },
    {
      key: "semiCrane",
      label: "Semi Crane Rate",
      render: (value: unknown) =>
        value ? `$${(value as number).toFixed(2)}` : null,
    },
  ];

  return (
    <ProtectedLayout>
      <div className="h-full flex flex-col">
        <div className="sticky top-0 z-30 bg-white dark:bg-background border-b">
          <PageControls type="customers" />
        </div>
        <div className="flex-1 overflow-hidden">
          {/* Conditional rendering: only show table when data is loaded OR not loading */}
          {(customers.length > 0 || !isLoading) ? (
            <UnifiedDataTable
              data={customers}
              columns={customerColumns(
                handleEdit,
                handleDelete,
                handleMultiDelete,
              )}
              sheetFields={customerSheetFields}
              mobileFields={customerMobileFields}
              getItemId={(customer) => customer.id}
              isLoading={isLoading}
              loadingRowId={loadingRowId}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onMultiDelete={handleMultiDelete}
              onAdd={handleAddNew}
              onImportSuccess={fetchCustomers}
              ToolbarComponent={CustomerDataTableToolbarWrapper}
            />
          ) : (
            <TableLoadingSkeleton rows={8} columns={10} />
          )}
        </div>
        <CustomerForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          customer={editingCustomer}
          isLoading={isSubmitting}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          title={
            customersToDelete.length > 1
              ? "Delete Multiple Customers"
              : "Delete Customer"
          }
          description={
            customersToDelete.length > 1
              ? "This will permanently remove these customers and all associated data."
              : "This will permanently remove this customer and all associated data."
          }
          itemName={
            customersToDelete.length === 1
              ? customersToDelete[0]?.customer
              : undefined
          }
          isLoading={isDeleting}
        />

        {/* Progress Dialog */}
        <ProgressDialog
          open={isDeleting}
          title="Deleting customers..."
          description="Please wait while the selected customers are deleted."
        />
      </div>
    </ProtectedLayout>
  );
};

export default CustomersPage;
