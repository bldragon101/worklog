"use client";

import * as React from "react";
import { DataTable } from "@/components/data-table/data-table";
import { customerColumns, Customer } from "@/components/customer-columns";
import { customerSheetFields } from "@/components/customer-sheet-fields";
import { CustomerDataTableToolbar } from "./customer-data-table-toolbar";

interface NewEnhancedCustomerDataTableProps {
  data: Customer[];
  isLoading: boolean;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  loadingRowId?: number | null;
  onImportSuccess?: () => void;
  onAddCustomer?: () => void;
  filters?: {
    customer?: string;
    billTo?: string;
  };
}

export function NewEnhancedCustomerDataTable({
  data,
  isLoading,
  onEdit,
  onDelete,
  loadingRowId,
  onImportSuccess,
  onAddCustomer,
  filters,
}: NewEnhancedCustomerDataTableProps) {
  // Create columns without actions since DataTable will add the sheet details
  const tableColumns = React.useMemo(
    () => customerColumns(onEdit, onDelete, isLoading, loadingRowId).filter(col => col.id !== 'actions'),
    [onEdit, onDelete, isLoading, loadingRowId]
  );

  // We need to get the table instance from DataTable component
  const [tableInstance, setTableInstance] = React.useState<unknown>(null);

  return (
    <div className="space-y-4">
      {tableInstance && (
        <CustomerDataTableToolbar 
          table={tableInstance}
          onImportSuccess={onImportSuccess}
          onAddCustomer={onAddCustomer}
        />
      )}
      <DataTable
        columns={tableColumns}
        data={data}
        sheetFields={customerSheetFields}
        onEdit={onEdit}
        onDelete={onDelete}
        isLoading={isLoading}
        loadingRowId={loadingRowId}
        onTableReady={setTableInstance}
      />
    </div>
  );
}