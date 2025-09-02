"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
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
    tray: "",
    crane: "",
    semi: "",
    semiCrane: "",
    fuelLevy: "",
    tolls: false,
    breakDeduction: "",
    comments: "",
  })

  useEffect(() => {
    if (customer) {
      setFormData({
        customer: customer.customer || "",
        billTo: customer.billTo || "",
        contact: customer.contact || "",
        tray: customer.tray?.toString() || "",
        crane: customer.crane?.toString() || "",
        semi: customer.semi?.toString() || "",
        semiCrane: customer.semiCrane?.toString() || "",
        fuelLevy: customer.fuelLevy?.toString() || "",
        tolls: customer.tolls || false,
        breakDeduction: customer.breakDeduction?.toString() || "",
        comments: customer.comments || "",
      })
    } else {
      setFormData({
        customer: "",
        billTo: "",
        contact: "",
        tray: "",
        crane: "",
        semi: "",
        semiCrane: "",
        fuelLevy: "",
        tolls: false,
        breakDeduction: "",
        comments: "",
      })
    }
  }, [customer, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const submitData: Partial<Customer> = {
      ...formData,
      tray: formData.tray ? parseInt(formData.tray) : null,
      crane: formData.crane ? parseInt(formData.crane) : null,
      semi: formData.semi ? parseInt(formData.semi) : null,
      semiCrane: formData.semiCrane ? parseInt(formData.semiCrane) : null,
      fuelLevy: formData.fuelLevy ? parseInt(formData.fuelLevy) : null,
      breakDeduction: formData.breakDeduction ? parseFloat(formData.breakDeduction) : null,
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
                className="rounded"
                value={formData.customer}
                onChange={(e) => handleInputChange("customer", e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="billTo" className="text-sm font-medium">
                Bill To *
              </label>
              <Input
                id="billTo"
                className="rounded"
                value={formData.billTo}
                onChange={(e) => handleInputChange("billTo", e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="contact" className="text-sm font-medium">
              Contact *
            </label>
            <Input
              id="contact"
              className="rounded"
              value={formData.contact}
              onChange={(e) => handleInputChange("contact", e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Service Rates ($)</label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="tray" className="text-sm font-medium">
                  Tray
                </label>
                <Input
                  id="tray"
                  className="rounded"
                  type="number"
                  value={formData.tray}
                  onChange={(e) => handleInputChange("tray", e.target.value)}
                  placeholder="Enter amount"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="crane" className="text-sm font-medium">
                  Crane
                </label>
                <Input
                  id="crane"
                  className="rounded"
                  type="number"
                  value={formData.crane}
                  onChange={(e) => handleInputChange("crane", e.target.value)}
                  placeholder="Enter amount"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="semi" className="text-sm font-medium">
                  Semi
                </label>
                <Input
                  id="semi"
                  className="rounded"
                  type="number"
                  value={formData.semi}
                  onChange={(e) => handleInputChange("semi", e.target.value)}
                  placeholder="Enter amount"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="semiCrane" className="text-sm font-medium">
                  Semi Crane
                </label>
                <Input
                  id="semiCrane"
                  className="rounded"
                  type="number"
                  value={formData.semiCrane}
                  onChange={(e) => handleInputChange("semiCrane", e.target.value)}
                  placeholder="Enter amount"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="fuelLevy" className="text-sm font-medium">
                Fuel Levy
              </label>
              <Select value={formData.fuelLevy} onValueChange={(value) => handleInputChange("fuelLevy", value)} disabled={isLoading}>
                <SelectTrigger className="rounded">
                  <SelectValue placeholder="Select percentage" />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="0">0%</SelectItem>
                  <SelectItem value="5">5%</SelectItem>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="15">15%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tolls</label>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="tolls"
                  checked={formData.tolls}
                  onCheckedChange={(checked) => handleInputChange("tolls", checked as boolean)}
                  disabled={isLoading}
                />
                <label htmlFor="tolls" className="text-sm">Include tolls</label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="break-deduction-input" className="text-sm font-medium">
              Break Deduction (hours) - over 7.5 hours
            </label>
            <Input
              id="break-deduction-input"
              className="rounded"
              type="number"
              step="0.1"
              min="0"
              value={formData.breakDeduction}
              onChange={(e) => handleInputChange("breakDeduction", e.target.value)}
              placeholder="Enter hours (e.g., 0.5)"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="comments" className="text-sm font-medium">
              Comments
            </label>
            <Textarea
              id="comments"
              className="rounded"
              value={formData.comments}
              onChange={(e) => handleInputChange("comments", e.target.value)}
              placeholder="Enter any additional comments..."
              rows={3}
              disabled={isLoading}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" className="rounded" disabled={isLoading}>
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </div>
              ) : (
                customer ? "Update Customer" : "Add Customer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
