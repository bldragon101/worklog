"use client";

import { useState } from "react";
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
import { TableLoadingSkeleton } from "@/components/ui/skeleton";
import { useEntityList } from "@/hooks/use-entity-list";

const CustomersPage = () => {
  const {
    items: customers,
    isFetching,
    refresh,
    isFormOpen,
    editingItem: editingCustomer,
    openAddForm,
    openEditForm,
    closeForm,
    loadingRowId,
    deleteItem,
    deleteDialogOpen,
    setDeleteDialogOpen,
    itemsToDelete: customersToDelete,
    isDeleting,
    requestMultiDelete,
    confirmMultiDelete,
  } = useEntityList<Customer>({
    resource: "customers",
    singularLabel: "customer",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          await refresh();
          closeForm();
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
          await refresh();
          closeForm();
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

  const handleDelete = (customer: Customer) => deleteItem({ item: customer });

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
          {customers.length > 0 || !isFetching ? (
            <UnifiedDataTable
              data={customers}
              columns={customerColumns(
                openEditForm,
                handleDelete,
                requestMultiDelete,
              )}
              sheetFields={customerSheetFields}
              mobileFields={customerMobileFields}
              getItemId={(customer) => customer.id}
              isLoading={isFetching}
              loadingRowId={loadingRowId}
              onEdit={openEditForm}
              onDelete={handleDelete}
              onMultiDelete={requestMultiDelete}
              onAdd={openAddForm}
              onImportSuccess={refresh}
              ToolbarComponent={CustomerDataTableToolbarWrapper}
              toolbarProps={{ onRefresh: refresh }}
            />
          ) : (
            <TableLoadingSkeleton rows={8} columns={10} />
          )}
        </div>
        <CustomerForm
          isOpen={isFormOpen}
          onClose={closeForm}
          onSubmit={handleFormSubmit}
          customer={editingCustomer}
          isLoading={isSubmitting}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmMultiDelete}
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
