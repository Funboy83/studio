
'use client';

import { useEffect, useState } from 'react';
import { getInvoiceById } from "@/lib/actions/invoice";
import { notFound } from 'next/navigation';
import { InvoiceTemplate } from "@/components/invoices/invoice-template";
import type { InvoiceDetail } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

function PrintTrigger({ invoiceId }: { invoiceId: string }) {
    const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getInvoiceById(invoiceId).then(data => {
            if (!data) {
                notFound();
            } else {
                setInvoice(data);
                setIsLoading(false);
            }
        });
    }, [invoiceId]);

    useEffect(() => {
        if (!isLoading && invoice) {
            const timer = setTimeout(() => {
                window.print();
                window.onafterprint = () => window.close();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isLoading, invoice]);

    if (isLoading || !invoice) {
        return (
            <div className="p-10 space-y-4">
                <Skeleton className="h-12 w-1/2" />
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }

    return <InvoiceTemplate invoice={invoice} />;
}


export default function InvoicePrintPage({ params }: { params: { id: string } }) {
  return <PrintTrigger invoiceId={params.id} />;
}
