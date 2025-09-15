

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { InvoiceDetail, Invoice } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InvoiceQuickView } from './invoice-quick-view';

interface InvoiceTableProps {
    invoices: InvoiceDetail[];
    title?: string;
    onArchive?: (invoice: InvoiceDetail) => void;
    showRefundInQuickView?: boolean;
}

export function InvoiceTable({ invoices, title = "Invoices", onArchive, showRefundInQuickView = false }: InvoiceTableProps) {
  const { toast } = useToast();
  const [quickViewInvoice, setQuickViewInvoice] = useState<InvoiceDetail | null>(null);

  const handleArchiveClick = (invoice: InvoiceDetail) => {
    if (onArchive) {
        onArchive(invoice);
    } else {
        toast({ title: "Archive function not provided."});
    }
  };

  const getCustomerName = (invoice: Invoice | InvoiceDetail) => {
    if ('customer' in invoice && invoice.customer) {
      return invoice.customer.name;
    }
    if ('customerName' in invoice && invoice.customerName) {
      return invoice.customerName;
    }
    return 'N/A';
  }

  const getPaymentStatusVariant = (status?: Invoice['status']) => {
    switch (status) {
      case 'Paid':
        return 'default';
      case 'Partial':
        return 'secondary';
      case 'Unpaid':
        return 'destructive';
      case 'Overdue':
        return 'destructive';
      default:
        return 'outline';
    }
  }

  return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                      <TableCell colSpan={7} className="text-center h-24">No invoices found.</TableCell>
                  </TableRow>
                ) : (
                  invoices.map((invoice) => (
                    <TableRow key={invoice.id} onClick={() => setQuickViewInvoice(invoice)} className="cursor-pointer">
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{getCustomerName(invoice)}</TableCell>
                      <TableCell>
                        <Badge variant={getPaymentStatusVariant(invoice.status)}>{invoice.status || 'Paid'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {invoice.status !== 'Voided' && <Badge variant="default" className="bg-green-600 hover:bg-green-700">Active</Badge>}
                          {invoice.isEdited && <Badge variant="secondary">Edited</Badge>}
                           {invoice.relatedCreditNoteId && (
                            <Link href={`/dashboard/credit-notes/${invoice.relatedCreditNoteId}`}>
                              <Badge 
                                variant="destructive" 
                                className="bg-orange-500 hover:bg-orange-600 cursor-pointer"
                              >
                                Returned
                              </Badge>
                            </Link>
                           )}
                        </div>
                      </TableCell>
                      <TableCell>{invoice.issueDate}</TableCell>
                      <TableCell className="text-right">${invoice.total.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                      <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0" disabled={invoice.status === 'Voided'} onClick={(e) => e.stopPropagation()}>
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onSelect={() => setQuickViewInvoice(invoice)}>
                                View Invoice
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild disabled={invoice.status === 'Paid' || invoice.status === 'Partial'}>
                                  <Link href={`/dashboard/invoices/${invoice.id}/edit`}>Edit Invoice</Link>
                              </DropdownMenuItem>
                              {onArchive && (
                                  <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                      className="text-destructive"
                                      disabled={invoice.status === 'Paid' || invoice.status === 'Partial'}
                                      onSelect={() => handleArchiveClick(invoice as InvoiceDetail)}>
                                      Void Invoice
                                  </DropdownMenuItem>
                                  </>
                              )}
                          </DropdownMenuContent>
                          </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Dialog open={!!quickViewInvoice} onOpenChange={(isOpen) => !isOpen && setQuickViewInvoice(null)}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
            {quickViewInvoice && (
              <>
                <DialogHeader className="p-6 pb-0">
                  <DialogTitle>Quick View: Invoice {quickViewInvoice.invoiceNumber}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-6">
                   <InvoiceQuickView invoice={quickViewInvoice} showRefundExchangeButton={showRefundInQuickView} />
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </>
  );
}
