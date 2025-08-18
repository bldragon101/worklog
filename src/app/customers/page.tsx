"use client"

import React, { useState, useEffect } from 'react';
import { UnifiedDataTable } from "@/components/data-table/core/unified-data-table";
import { CustomerForm } from "@/components/entities/customer/customer-form";
import { Customer } from "@/lib/types";
import { customerColumns } from "@/components/entities/customer/customer-columns";
import { customerSheetFields } from "@/components/entities/customer/customer-sheet-fields";
import { CustomerDataTableToolbarWrapper } from "@/components/entities/customer/customer-data-table-toolbar-wrapper";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { PageControls } from "@/components/layout/page-controls";

const CustomersPage = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingRowId, setLoadingRowId] = useState<number | null>(null);

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/customers');
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      } else {
        console.error('Failed to fetch customers');
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
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
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(customerData),
        });

        if (response.ok) {
          await fetchCustomers();
          setIsFormOpen(false);
          setEditingCustomer(null);
        } else {
          console.error('Failed to update customer');
        }
      } else {
        // Create new customer
        const response = await fetch('/api/customers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(customerData),
        });

        if (response.ok) {
          await fetchCustomers();
          setIsFormOpen(false);
        } else {
          console.error('Failed to create customer');
        }
      }
    } catch (error) {
      console.error('Error submitting customer:', error);
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
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchCustomers();
      } else {
        const errorData = await response.json();
        console.error('Failed to delete customer:', errorData.error);
        throw new Error(errorData.error || 'Failed to delete customer');
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error; // Re-throw to let the dialog handle the error
    } finally {
      setLoadingRowId(null);
    }
  };

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
      key: 'customer',
      label: 'Customer',
      isTitle: true,
    },
    {
      key: 'billTo',
      label: 'Bill To',
      isSubtitle: true,
    },
    {
      key: 'fuelLevy',
      label: 'Fuel Levy',
      render: (value: unknown) => value ? `${(value as number).toFixed(2)}%` : null,
    },
    {
      key: 'tray',
      label: 'Tray Rate',
      render: (value: unknown) => value ? `$${(value as number).toFixed(2)}` : null,
    },
    {
      key: 'crane',
      label: 'Crane Rate',
      render: (value: unknown) => value ? `$${(value as number).toFixed(2)}` : null,
    },
    {
      key: 'semi',
      label: 'Semi Rate',
      render: (value: unknown) => value ? `$${(value as number).toFixed(2)}` : null,
    },
    {
      key: 'semiCrane',
      label: 'Semi Crane Rate',
      render: (value: unknown) => value ? `$${(value as number).toFixed(2)}` : null,
    },
  ];

  return (
    <ProtectedLayout>
      <div className="flex flex-col h-full w-full max-w-full space-y-4">
        <PageControls
          type="customers"
        />

        <div className="flex-1 w-full max-w-full">
          <div className="px-4 pb-4 h-full">
            <UnifiedDataTable
              data={customers}
              columns={customerColumns(handleEdit, handleDelete)}
              sheetFields={customerSheetFields}
              mobileFields={customerMobileFields}
              getItemId={(customer) => customer.id}
              isLoading={isLoading}
              loadingRowId={loadingRowId}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAdd={handleAddNew}
              onImportSuccess={fetchCustomers}
              ToolbarComponent={CustomerDataTableToolbarWrapper}
            />
          </div>
        </div>

        <CustomerForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          customer={editingCustomer}
          isLoading={isSubmitting}
        />
      </div>
    </ProtectedLayout>
  );
};

export default CustomersPage;
