"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Customer } from "./customer-columns"

interface CustomerFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (customer: Partial<Customer>) => void
  customer?: Customer | null
  isLoading?: boolean
}

export function CustomerForm({ isOpen, onClose, onSubmit, customer, isLoading = false }: CustomerFormProps) {
  const [formData, setFormData] = useState({
    customer: "",
    billTo: "",
    contact: "",
    email: "",
    phoneNumber: "",
    tray: false,
    crane: false,
    semi: false,
    semiCrane: false,
    fuelLevy: "",
    tolls: "",
    comments: "",
  })

  useEffect(() => {
    if (customer) {
      setFormData({
        customer: customer.customer || "",
        billTo: customer.billTo || "",
        contact: customer.contact || "",
        email: customer.email || "",
        phoneNumber: customer.phoneNumber || "",
        tray: customer.tray || false,
        crane: customer.crane || false,
        semi: customer.semi || false,
        semiCrane: customer.semiCrane || false,
        fuelLevy: customer.fuelLevy?.toString() || "",
        tolls: customer.tolls?.toString() || "",
        comments: customer.comments || "",
      })
    } else {
      setFormData({
        customer: "",
        billTo: "",
        contact: "",
        email: "",
        phoneNumber: "",
        tray: false,
        crane: false,
        semi: false,
        semiCrane: false,
        fuelLevy: "",
        tolls: "",
        comments: "",
      })
    }
  }, [customer, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const submitData: Partial<Customer> = {
      ...formData,
      fuelLevy: formData.fuelLevy ? parseInt(formData.fuelLevy) : null,
      tolls: formData.tolls ? parseFloat(formData.tolls) : null,
      comments: formData.comments || null,
    }

    if (customer) {
      submitData.id = customer.id
    }

    onSubmit(submitData)
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
          <DialogDescription>
            {customer ? "Update customer information." : "Enter the details for the new customer."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="customer" className="text-sm font-medium">
                Customer *
              </label>
              <Input
                id="customer"
                value={formData.customer}
                onChange={(e) => handleInputChange("customer", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="billTo" className="text-sm font-medium">
                Bill To *
              </label>
              <Input
                id="billTo"
                value={formData.billTo}
                onChange={(e) => handleInputChange("billTo", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="contact" className="text-sm font-medium">
                Contact *
              </label>
              <Input
                id="contact"
                value={formData.contact}
                onChange={(e) => handleInputChange("contact", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email *
              </label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="phoneNumber" className="text-sm font-medium">
              Phone Number *
            </label>
            <Input
              id="phoneNumber"
              value={formData.phoneNumber}
              onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
              required
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Services</label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tray"
                  checked={formData.tray}
                  onCheckedChange={(checked) => handleInputChange("tray", checked as boolean)}
                />
                <label htmlFor="tray" className="text-sm">Tray</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="crane"
                  checked={formData.crane}
                  onCheckedChange={(checked) => handleInputChange("crane", checked as boolean)}
                />
                <label htmlFor="crane" className="text-sm">Crane</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="semi"
                  checked={formData.semi}
                  onCheckedChange={(checked) => handleInputChange("semi", checked as boolean)}
                />
                <label htmlFor="semi" className="text-sm">Semi</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="semiCrane"
                  checked={formData.semiCrane}
                  onCheckedChange={(checked) => handleInputChange("semiCrane", checked as boolean)}
                />
                <label htmlFor="semiCrane" className="text-sm">Semi Crane</label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="fuelLevy" className="text-sm font-medium">
                Fuel Levy
              </label>
              <Input
                id="fuelLevy"
                type="number"
                value={formData.fuelLevy}
                onChange={(e) => handleInputChange("fuelLevy", e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="tolls" className="text-sm font-medium">
                Tolls (%)
              </label>
              <Input
                id="tolls"
                type="number"
                step="0.01"
                value={formData.tolls}
                onChange={(e) => handleInputChange("tolls", e.target.value)}
                placeholder="Enter percentage"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="comments" className="text-sm font-medium">
              Comments
            </label>
            <Textarea
              id="comments"
              value={formData.comments}
              onChange={(e) => handleInputChange("comments", e.target.value)}
              placeholder="Enter any additional comments..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : customer ? "Update Customer" : "Add Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
