"use client"

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { NewEnhancedCustomerDataTable } from "@/components/NewEnhancedCustomerDataTable";
import { CustomerForm } from "@/components/CustomerForm";
import { Customer } from "@/components/customer-columns";
import { Plus } from "lucide-react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Logo } from "@/components/Logo";
import { PageControls } from "@/components/page-controls";

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
    if (confirm('Are you sure you want to delete this customer?')) {
      setLoadingRowId(customer.id);
      try {
        const response = await fetch(`/api/customers/${customer.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          await fetchCustomers();
        } else {
          console.error('Failed to delete customer');
        }
      } catch (error) {
        console.error('Error deleting customer:', error);
      } finally {
        setLoadingRowId(null);
      }
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

  return (
    <ProtectedLayout>
      <div className="flex flex-col h-full space-y-4">
        <PageControls
          type="customers"
        />

        <div className="flex-1">
          <NewEnhancedCustomerDataTable
            data={customers}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            loadingRowId={loadingRowId}
            onImportSuccess={fetchCustomers}
            onAddCustomer={handleAddNew}
          />
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
