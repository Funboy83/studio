
"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { InvoiceDetail } from "@/lib/types"
import { Printer, Wallet } from "lucide-react"
import { Badge } from "../ui/badge"
import { InvoiceTemplate } from "./invoice-template"

interface InvoicePreviewProps {
  invoice: InvoiceDetail;
  isEdited?: boolean;
}

export function InvoicePreview({ invoice, isEdited = false }: InvoicePreviewProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div className="flex items-center gap-4 print:hidden">
        <div className="flex-1" />
        <Button onClick={handlePrint} variant="outline">
          <Printer className="mr-2 h-4 w-4" />
          Print / Save PDF
        </Button>
      </div>
      
      {invoice.payments && invoice.payments.length > 0 && (
          <Card className="w-full max-w-4xl mx-auto mb-4 print:hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
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

      <InvoiceTemplate invoice={invoice} isEdited={isEdited} />
    </>
  );
}
