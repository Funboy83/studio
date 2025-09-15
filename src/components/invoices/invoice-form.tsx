

"use client"

import React, { useState, useMemo, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { X, Plus, CalendarIcon, Loader2, UserPlus, History, Eye } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { InventoryPicker } from './inventory-picker';
import { Product, Customer, InvoiceItem, InvoiceDetail, Invoice } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getLatestInvoiceNumber, sendInvoice, updateInvoice } from '@/lib/actions/invoice';
import { AddCustomerForm } from '../customers/add-customer-form';
import { Checkbox } from '../ui/checkbox';
import { InvoicePreview } from './preview';
import { Logo } from '../logo';
import { Combobox } from '@/components/ui/combobox';

interface InvoiceFormProps {
  invoice?: InvoiceDetail;
  inventory: Product[];
  customers: Customer[];
}

const WALK_IN_CUSTOMER_ID = 'Aj0l1O2kJcvlF3J0uVMX';

export function InvoiceForm({ invoice, inventory, customers }: InvoiceFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, startSavingTransition] = useTransition();

  const isEditMode = !!invoice;
  
  const [initialInvoice] = useState(invoice);

  const [showPreview, setShowPreview] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>(invoice?.items || []);
  
  const [isWalkIn, setIsWalkIn] = useState(invoice?.customer.id === WALK_IN_CUSTOMER_ID);
  const [walkInCustomerName, setWalkInCustomerName] = useState(
    invoice?.customer.id === WALK_IN_CUSTOMER_ID ? invoice.customer.name.replace('Walk-In - ', '') : ''
  );
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>(() => {
    if (isEditMode) return invoice.customer;
    return customers.find(c => c.id !== WALK_IN_CUSTOMER_ID);
  });
  
  const [dueDate, setDueDate] = useState<Date | undefined>(invoice?.dueDate ? parseISO(invoice.dueDate) : new Date());
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState<string>(invoice?.invoiceNumber || '...');

  const calculateInitialPercentage = (value: number, subtotal: number) => {
    if (subtotal === 0) return 0;
    return parseFloat(((value / subtotal) * 100).toFixed(2));
  }

  const [taxRate, setTaxRate] = useState(invoice ? calculateInitialPercentage(invoice.tax, invoice.subtotal) : 0);
  const [discount, setDiscount] = useState(invoice ? calculateInitialPercentage(invoice.discount || 0, invoice.subtotal) : 0);
  const [notes, setNotes] = useState(invoice?.summary || '');

  const [isCashPayment, setIsCashPayment] = useState(false);
  const [isCardPayment, setIsCardPayment] = useState(false);
  const [cashAmount, setCashAmount] = useState(0);
  const [cardAmount, setCardAmount] = useState(0);
  
  useEffect(() => {
    if (!isEditMode) {
      async function fetchInvoiceNumber() {
        const nextNumber = await getLatestInvoiceNumber();
        setInvoiceNumber(String(nextNumber));
      }
      fetchInvoiceNumber();
    }
  }, [isEditMode]);

  const displayCustomers = useMemo(() => {
    return customers.filter(c => c.id !== WALK_IN_CUSTOMER_ID);
  }, [customers]);

  const customerOptions = useMemo(() => {
    return displayCustomers.map(customer => ({
      value: customer.id,
      label: `${customer.name} - ${customer.email}`
    }));
  }, [displayCustomers]);

  useEffect(() => {
    if (isWalkIn) {
      const walkInCustomer = customers.find(c => c.id === WALK_IN_CUSTOMER_ID);
      setSelectedCustomer(walkInCustomer);
    } else {
      if (selectedCustomer?.id === WALK_IN_CUSTOMER_ID) {
        setSelectedCustomer(displayCustomers[0]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWalkIn, customers, displayCustomers]);


  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomer(customers.find(c => c.id === customerId));
  };
  
  const handleAddItems = (selectedProducts: Product[]) => {
    const existingItemIds = new Set(items.map(item => item.id));
    const newProducts = selectedProducts.filter(p => !existingItemIds.has(p.id));
    const duplicateCount = selectedProducts.length - newProducts.length;

    if (newProducts.length > 0) {
      const newItems: InvoiceItem[] = newProducts.map(product => ({
        id: product.id,
        productName: `${product.brand} ${product.model}`,
        description: `${product.imei} - ${product.storage} - ${product.color}`,
        quantity: 1,
        unitPrice: product.price,
        total: product.price,
        isCustom: false,
      }));
      setItems(prev => [...prev, ...newItems]);
    }
    
    setIsPickerOpen(false);
    
    let toastDescription = '';
    if (newProducts.length > 0) {
      toastDescription += `${newProducts.length} new item(s) have been added.`;
    }
    if (duplicateCount > 0) {
      toastDescription += ` ${duplicateCount} item(s) were already in the invoice and were not added again.`
    }
    
    if (toastDescription) {
      toast({
        title: 'Items Processed',
        description: toastDescription,
      });
    }

    if (newProducts.length === 0 && selectedProducts.length > 0) {
      toast({
        title: 'Items Already in Invoice',
        description: `All ${selectedProducts.length} selected item(s) are already in the invoice.`,
      });
    }
  };

  const handleAddCustomItem = () => {
    const newItem: InvoiceItem = {
      id: `custom-${Date.now()}`,
      productName: '',
      description: 'Custom item',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      isCustom: true,
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleItemChange = (itemId: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item };
        
        if (field === 'unitPrice' || field === 'quantity') {
            (updatedItem as any)[field] = Number(value) || 0;
        } else {
          (updatedItem as any)[field] = value;
        }

        updatedItem.total = updatedItem.unitPrice * updatedItem.quantity;
        return updatedItem;
      }
      return item;
    }));
  };

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + item.total, 0), [items]);
  const taxAmount = useMemo(() => subtotal * (taxRate / 100), [subtotal, taxRate]);
  const discountAmount = useMemo(() => subtotal * (discount / 100), [subtotal, discount]);
  const total = useMemo(() => subtotal + taxAmount - discountAmount, [subtotal, taxAmount, discountAmount]);

  const totalPaid = useMemo(() => (isCashPayment ? cashAmount : 0) + (isCardPayment ? cardAmount : 0), [isCashPayment, cashAmount, isCardPayment, cardAmount]);
  const amountDue = useMemo(() => total - totalPaid, [total, totalPaid]);
  
  
  const handleSave = () => {
    if (!selectedCustomer) {
      toast({ title: 'Error', description: 'Please select a customer.', variant: 'destructive' });
      return;
    }
    if (items.length === 0 && !isEditMode) {
        toast({ title: 'Error', description: 'Please add at least one item.', variant: 'destructive' });
        return;
    }

    startSavingTransition(async () => {
      const finalCustomerName = isWalkIn && walkInCustomerName.trim() !== ''
        ? `Walk-In - ${walkInCustomerName.trim()}`
        : selectedCustomer.name;

      if (isEditMode && initialInvoice) {
        // Update logic
        const updatedInvoiceData: Omit<Invoice, 'id' | 'createdAt' | 'status'> = {
          invoiceNumber,
          customerId: selectedCustomer.id,
          customerName: finalCustomerName,
          subtotal,
          tax: taxAmount,
          discount: discountAmount,
          total,
          issueDate: initialInvoice.issueDate,
          dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : '',
          summary: notes,
          amountPaid: initialInvoice.amountPaid,
          paymentIds: initialInvoice.paymentIds,
        };
        const result = await updateInvoice({
            originalInvoice: initialInvoice,
            updatedInvoice: updatedInvoiceData,
            updatedItems: items,
        });

        if (result.success) {
          toast({ title: 'Invoice Updated!', description: `Invoice ${invoiceNumber} has been successfully updated.` });
          router.push(`/dashboard/invoices/${invoice.id}`);
        } else {
          toast({ title: 'Error', description: result.error || 'Failed to update invoice.', variant: 'destructive' });
        }
      } else {
        // Create logic
        const invoiceData: Omit<Invoice, 'id' | 'createdAt'> = {
          invoiceNumber,
          customerName: finalCustomerName,
          customerId: selectedCustomer.id,
          subtotal,
          tax: taxAmount,
          discount: discountAmount,
          total,
          issueDate: new Date().toISOString().split('T')[0],
          dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : '',
          summary: notes,
          status: 'Draft', // Status is determined on the server now
          amountPaid: 0, // Server will handle this
          paymentIds: [], // Server will handle this
        };
        
        const result = await sendInvoice({ 
            invoiceData, 
            items, 
            customer: selectedCustomer,
            cashAmount: isCashPayment ? cashAmount : 0,
            cardAmount: isCardPayment ? cardAmount : 0,
        });

        if (result.success) {
          toast({ title: 'Invoice Sent!', description: `Invoice ${invoiceNumber} has been created.` });
          router.push('/dashboard/invoices');
        } else {
          toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
      }
    });
  };

  const displayedCustomer = isWalkIn && selectedCustomer ? {
    ...selectedCustomer,
    name: walkInCustomerName.trim() !== '' ? `Walk-In - ${walkInCustomerName.trim()}` : 'Walk-In Customer',
    email: '',
    address: ''
  } : selectedCustomer;

  const previewInvoice: InvoiceDetail | null = displayedCustomer ? {
    id: invoice?.id || 'preview-id',
    invoiceNumber,
    customer: displayedCustomer,
    items,
    subtotal,
    tax: taxAmount,
    discount: discountAmount,
    total,
    issueDate: invoice?.issueDate || new Date().toISOString().split('T')[0],
    dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : '',
    status: invoice?.status || 'Draft',
    summary: notes,
    createdAt: invoice?.createdAt || new Date().toISOString(),
    amountPaid: isEditMode ? invoice.amountPaid : totalPaid,
    paymentIds: invoice?.paymentIds || [],
  } : null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditMode ? '' : 'New Invoice'}
          </h1>
           <div className="flex items-center space-x-2">
            <Switch id="show-preview" checked={showPreview} onCheckedChange={setShowPreview} />
            <Label htmlFor="show-preview">Show Preview</Label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditMode && (
            <Button variant="outline" onClick={() => toast({ title: 'Coming soon!'})}>Save as Draft</Button>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Invoice'}
          </Button>
        </div>
      </div>

      <div className={cn("flex-1 grid grid-cols-1 gap-8 overflow-auto", showPreview && "lg:grid-cols-2")}>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>Invoice details</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                  <div className="flex items-center justify-between">
                      <Label>Bill to</Label>
                      <div className="flex items-center space-x-2">
                        <Switch id="walk-in-switch" checked={isWalkIn} onCheckedChange={setIsWalkIn} />
                        <Label htmlFor="walk-in-switch">Walk-in Customer</Label>
                      </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <Combobox
                          options={customerOptions}
                          value={selectedCustomer?.id}
                          onChange={handleSelectCustomer}
                          disabled={isWalkIn}
                          placeholder="Select a customer..."
                          searchPlaceholder="Search customers..."
                          emptyPlaceholder="No customers found."
                        />
                    </div>
                    <Button variant="outline" size="icon" onClick={() => setIsAddCustomerOpen(true)} disabled={isWalkIn}>
                        <UserPlus className="h-5 w-5" />
                        <span className="sr-only">Add New Customer</span>
                    </Button>
                  </div>
                  
                  {isWalkIn && (
                    <Input 
                      placeholder="Enter customer name for receipt (optional)"
                      value={walkInCustomerName}
                      onChange={(e) => setWalkInCustomerName(e.target.value)}
                      className="mt-2"
                    />
                  )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice-number">Invoice number</Label>
                  <Input id="invoice-number" value={invoiceNumber} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due-date">Due date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="due-date"
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Invoice items</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div>
                  <Label>Items</Label>
                  <div className="space-y-2 mt-2">
                    {items.map(item => (
                      <div key={item.id} className="grid grid-cols-[1fr_80px_100px_100px_auto] gap-2 items-center">
                        <div className="flex flex-col">
                            <Input 
                                value={item.productName} 
                                readOnly={!item.isCustom}
                                onChange={e => handleItemChange(item.id, 'productName', e.target.value)}
                                className={cn("font-medium", !item.isCustom && "bg-gray-100 border-0")}
                                placeholder="Item name"
                            />
                            {item.description && (
                                <p className="text-xs text-muted-foreground px-3">{item.description}</p>
                            )}
                        </div>
                        <Input 
                            type="number"
                            value={item.quantity}
                            onChange={e => handleItemChange(item.id, 'quantity', e.target.value)}
                            className="text-right"
                            placeholder="1"
                        />
                        <Input 
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={e => handleItemChange(item.id, 'unitPrice', e.target.value)}
                            className="text-right"
                            placeholder="0.00"
                        />
                        <Input value={item.total.toFixed(2)} readOnly className="bg-gray-100 text-right" />
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={handleAddCustomItem}><Plus className="mr-2 h-4 w-4" /> Add custom item</Button>
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="ghost"><Plus className="mr-2 h-4 w-4" /> Add from inventory</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => setIsPickerOpen(true)}>
                              Phone Inventory
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => toast({ title: 'Coming Soon!', description: 'Managing accessories will be available in a future update.'})}>
                              Accessories
                          </DropdownMenuItem>
                      </DropdownMenuContent>
                  </DropdownMenu>
                </div>
            </CardContent>
          </Card>
           
          <Card>
              <CardHeader>
                  <CardTitle>Summary & Payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                      <Label htmlFor="tax" className="flex items-center gap-2">
                          Tax (%) 
                          <Input id="tax" type="number" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} placeholder="0" className="w-20 h-8" />
                      </Label>
                      <span>${taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                      <Label htmlFor="discount" className="flex items-center gap-2">
                          Discount (%)
                          <Input id="discount" type="number" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} placeholder="0" className="w-20 h-8" />
                      </Label>
                      <span className="text-destructive">-${discountAmount.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>${total.toFixed(2)}</span>
                  </div>
                   {!isEditMode && (
                    <>
                        <Separator />
                        <div className="flex items-center gap-4 pt-2">
                            <Checkbox id="cash-payment" checked={isCashPayment} onCheckedChange={(checked) => setIsCashPayment(!!checked)} />
                            <Label htmlFor="cash-payment" className="flex-1">Cash</Label>
                            <Input 
                                type="number"
                                placeholder="0.00"
                                value={cashAmount}
                                onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
                                disabled={!isCashPayment}
                                className="max-w-[120px]"
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <Checkbox id="card-payment" checked={isCardPayment} onCheckedChange={(checked) => setIsCardPayment(!!checked)} />
                            <Label htmlFor="card-payment" className="flex-1">Credit Card</Label>
                            <Input 
                                type="number"
                                placeholder="0.00"
                                value={cardAmount}
                                onChange={(e) => setCardAmount(parseFloat(e.target.value) || 0)}
                                disabled={!isCardPayment}
                                className="max-w-[120px]"
                            />
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <div className="flex justify-between font-medium">
                                <Label>Total Paid</Label>
                                <span>${totalPaid.toFixed(2)}</span>
                            </div>
                            <div className={cn("flex justify-between font-bold text-lg", amountDue > 0 ? "text-destructive" : "text-green-600")}>
                                <Label>{amountDue >= 0 ? 'Amount Due' : 'Change'}</Label>
                                <span>${Math.abs(amountDue).toFixed(2)}</span>
                            </div>
                        </div>
                    </>
                   )}
              </CardContent>
          </Card>

          <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent>
              <Textarea 
                  id="notes" 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add any relevant notes for the invoice..."
                  rows={4}
              />
              </CardContent>
          </Card>
        </div>
        {showPreview && previewInvoice && (
          <div className="hidden lg:block">
            <div className="sticky top-0">
               <InvoicePreview invoice={previewInvoice} />
            </div>
          </div>
        )}
      </div>
      <InventoryPicker
        isOpen={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        inventory={inventory}
        onAddItems={handleAddItems}
      />
      <AddCustomerForm isOpen={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen} />
    </div>
  );
}

    
    
