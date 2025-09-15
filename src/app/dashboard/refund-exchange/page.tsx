
'use client';

import { useState } from 'react';
import { getCustomers } from '@/lib/actions/customers';
import { CustomerTable } from '@/app/dashboard/customers/customer-table';
import { RefundStats } from '@/components/refund-exchange/stats-cards';
import type { Customer, InvoiceDetail } from '@/lib/types';
import { useAsyncEffect } from '@/hooks/use-async-effect';
import { getCustomerDetails } from '@/lib/actions/customers';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Mail, Phone } from 'lucide-react';
import { InvoiceTable } from '@/components/invoices/invoice-table';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

function CustomerDetailModal({ customerId, isOpen, onOpenChange }: { customerId: string | null, isOpen: boolean, onOpenChange: (isOpen: boolean) => void }) {
    const [customerDetails, setCustomerDetails] = useState<{ customer: Customer, invoices: InvoiceDetail[] } | null>(null);
    const [loading, setLoading] = useState(false);

    useAsyncEffect(async () => {
        if (customerId) {
            setLoading(true);
            const details = await getCustomerDetails(customerId);
            setCustomerDetails(details);
            setLoading(false);
        }
    }, [customerId]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Customer Details</DialogTitle>
                    <DialogDescription>Review customer history and select an invoice to process a refund or exchange.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto space-y-4">
                    {loading && (
                        <div className="space-y-4">
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-48 w-full" />
                        </div>
                    )}
                    {customerDetails && (
                        <>
                            <Card>
                                <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-4">
                                    <Avatar className="w-16 h-16 text-2xl">
                                        <AvatarFallback>{customerDetails.customer.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <CardTitle className="text-3xl">{customerDetails.customer.name}</CardTitle>
                                            <Badge className={cn('text-base', customerDetails.customer.status === 'active' ? 'bg-green-600' : 'bg-gray-500')}>{customerDetails.customer.status}</Badge>
                                        </div>
                                        <div className="mt-1 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-4">
                                                <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {customerDetails.customer.email}</span>
                                                <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> {customerDetails.customer.phone}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Link href={`/dashboard/customers/${customerDetails.customer.id}`} passHref>
                                        <Button variant="outline" size="sm">
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            Full Profile
                                        </Button>
                                    </Link>
                                </CardHeader>
                            </Card>
                            <InvoiceTable 
                                invoices={customerDetails.invoices.filter(inv => inv.status === 'Paid')} 
                                title="Paid Invoices (Eligible for Refund/Exchange)"
                                showRefundInQuickView={true}
                            />
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}


export default function RefundExchangePage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useAsyncEffect(async () => {
        const fetchedCustomers = await getCustomers();
        // Filter out the walk-in customer
        setCustomers(fetchedCustomers.filter(c => c.id !== 'Aj0l1O2kJcvlF3J0uVMX'));
    }, []);

    const handleRowClick = (customer: Customer) => {
        setSelectedCustomerId(customer.id);
        setIsModalOpen(true);
    };

    const stats = {
        totalRefunds: 0,
        totalExchanges: 0,
        pendingActions: 0,
        refundedValue: 0,
    };

    return (
        <>
            <div className="flex flex-col gap-6">
                <h1 className="text-3xl font-bold tracking-tight">Refund & Exchange</h1>
                <p className="text-muted-foreground">Select a customer to begin a refund or exchange process for one of their paid invoices.</p>
                <CustomerTable 
                    customers={customers} 
                    showAddCustomerButton={false} 
                    onRowClick={handleRowClick}
                    hideActions={true}
                />
            </div>
            <CustomerDetailModal 
                customerId={selectedCustomerId}
                isOpen={isModalOpen}
                onOpenChange={setIsModalOpen}
            />
        </>
    );
}
