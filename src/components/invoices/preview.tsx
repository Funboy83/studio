
"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { InvoiceDetail } from "@/lib/types"
import { Printer, Wallet, User, Calendar, Hash, FileText, BadgeCheck } from "lucide-react"
import { Badge } from "../ui/badge"
import { InvoiceTemplate } from "./invoice-template"
import { Separator } from "../ui/separator"
import Link from "next/link"

interface InvoicePreviewProps {
  invoice: InvoiceDetail;
  isEdited?: boolean;
}

const getStatusVariant = (status?: string) => {
    switch (status) {
      case 'Paid':
        return 'default';
      case 'Partial':
        return 'secondary';
      case 'Unpaid':
      case 'Overdue':
        return 'destructive';
      default:
        return 'outline';
    }
}

export function InvoicePreview({ invoice, isEdited = false }: InvoicePreviewProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-muted/30 p-4 rounded-lg">
      <div className="print-ui print:hidden">
        <div className="flex items-center gap-4 mb-4">
            <div className="flex-1" />
            <Button onClick={handlePrint} variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Print / Save PDF
            </Button>
        </div>

        {invoice.payments && invoice.payments.length > 0 && (
            <Card className="w-full max-w-4xl mx-auto mb-4">
                <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Wallet className="h-5 w-5" />
                    Payment History
                </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                {invoice.payments.map(payment => (
                    <div key={payment.id} className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex justify-between items-center">
                            <p className="font-semibold text-sm">
                                Payment on {new Date(payment.paymentDate).toLocaleDateString()}
                            </p>
                            <p className="font-bold text-lg text-green-600">
                                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(payment.amountPaid)}
                            </p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {payment.tenderDetails.map((tender, index) => (
                                <Badge key={index} variant="secondary">
                                    {tender.method}: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(tender.amount)}
                                </Badge>
                            ))}
                        </div>
                        {payment.notes && (
                            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">Note: {payment.notes}</p>
                        )}
                    </div>
                ))}
                </CardContent>
            </Card>
        )}
      
        <Card className="w-full max-w-4xl mx-auto">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold">Invoice {invoice.invoiceNumber}</h1>
                        <p className="text-muted-foreground">Details for invoice</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isEdited && <Badge variant="secondary">Edited</Badge>}
                        <Badge variant={getStatusVariant(invoice.status)} className="capitalize">{invoice.status}</Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-base flex items-center"><User className="mr-2 h-4 w-4"/> Billed To</h3>
                        <div className="text-muted-foreground">
                            <Link href={`/dashboard/customers/${invoice.customer.id}`} className="font-bold text-primary hover:underline">{invoice.customer.name}</Link>
                            <p>{invoice.customer.email}</p>
                            <p>{invoice.customer.phone}</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                         <h3 className="font-semibold text-base flex items-center"><FileText className="mr-2 h-4 w-4"/> Invoice Info</h3>
                         <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                            <span className="font-semibold text-foreground flex items-center"><Hash className="mr-1.5 h-3 w-3"/>Invoice #</span>
                            <span>{invoice.invoiceNumber}</span>
                            <span className="font-semibold text-foreground flex items-center"><Calendar className="mr-1.5 h-3 w-3"/>Issue Date</span>
                            <span>{invoice.issueDate}</span>
                            <span className="font-semibold text-foreground flex items-center"><Calendar className="mr-1.5 h-3 w-3"/>Due Date</span>
                            <span>{invoice.dueDate}</span>
                         </div>
                    </div>
                    <div className="space-y-4 text-right">
                         <h3 className="font-semibold text-base flex items-center justify-end"><BadgeCheck className="mr-2 h-4 w-4"/> Amount Due</h3>
                         <p className="text-4xl font-bold text-foreground">
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(invoice.total - invoice.amountPaid)}
                         </p>
                    </div>
                </div>

                <Separator className="my-8" />

                <div>
                    <h3 className="text-lg font-bold mb-4">Items</h3>
                     <div className="space-y-3 border rounded-lg">
                        {invoice.items.map(item => (
                            <div key={item.id} className="flex justify-between items-center p-4 border-b last:border-b-0">
                                <div>
                                    <p className="font-semibold">{item.productName}</p>
                                    <p className="text-muted-foreground text-xs">{item.description}</p>
                                    <p className="text-muted-foreground text-xs">{item.quantity} x {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.unitPrice)}</p>
                                </div>
                                <p className="font-bold text-lg">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.total)}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end mt-8">
                    <div className="w-full max-w-sm space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(invoice.subtotal)}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-muted-foreground">Tax</span>
                            <span>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(invoice.tax)}</span>
                        </div>
                        {invoice.discount && invoice.discount > 0 && (
                            <div className="flex justify-between text-destructive">
                                <span className="text-muted-foreground">Discount</span>
                                <span>-{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(invoice.discount)}</span>
                            </div>
                        )}
                        <Separator />
                        <div className="flex justify-between font-bold text-xl">
                            <span>Total</span>
                            <span>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(invoice.total)}</span>
                        </div>
                        {invoice.amountPaid > 0 && (
                            <div className="flex justify-between text-green-600">
                                <span>Amount Paid</span>
                                <span>-{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(invoice.amountPaid)}</span>
                            </div>
                        )}
                    </div>
                </div>
                {invoice.summary && (
                    <>
                        <Separator className="my-8" />
                        <div>
                            <h3 className="font-semibold text-base mb-2">Notes</h3>
                            <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">{invoice.summary}</p>
                        </div>
                    </>
                )}

            </CardContent>
        </Card>
      </div>

      <div className="print-template hidden print:block">
        <InvoiceTemplate invoice={invoice} />
      </div>
    </div>
  );
}
