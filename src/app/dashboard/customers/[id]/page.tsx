

import { getCustomerDetails } from '@/lib/actions/customers';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, Phone, Edit, DollarSign, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { InvoiceTable } from '@/components/invoices/invoice-table';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { InvoiceDetail } from '@/lib/types';

const WALK_IN_CUSTOMER_ID = 'Aj0l1O2kJcvlF3J0uVMX';

export default async function CustomerDetailsPage({ params }: { params: { id: string } }) {
  const data = await getCustomerDetails(params.id);

  if (!data) {
    notFound();
  }

  const { customer, invoices } = data;
  const isWalkInCustomer = customer.id === WALK_IN_CUSTOMER_ID;
  const hasDebt = customer.debt > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/customers" passHref>
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to Customers</span>
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Customer Details</h1>
        {!isWalkInCustomer && (
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline">
              <DollarSign className="mr-2 h-4 w-4" />
              Send Reminder
            </Button>
            {hasDebt && (
                <Link href={`/dashboard/customers/${customer.id}/payment`} passHref>
                <Button>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Record Payment
                </Button>
                </Link>
            )}
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit Customer
            </Button>
          </div>
        )}
      </div>
      
      <Card>
        <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-4">
          <Avatar className="w-16 h-16 text-2xl">
            <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <CardTitle className="text-3xl">{customer.name}</CardTitle>
              <Badge className={cn('text-base', customer.status === 'active' ? 'bg-green-600' : 'bg-gray-500')}>{customer.status}</Badge>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {customer.email}</span>
                <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> {customer.phone}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-right">
              <div>
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(customer.totalSpent)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Invoices</p>
                <p className="text-2xl font-bold">{customer.totalInvoices}</p>
              </div>
               {!isWalkInCustomer && (
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Outstanding Debt</p>
                  <p className="text-2xl font-bold text-destructive">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(customer.debt)}
                  </p>
                </div>
              )}
          </div>
        </CardHeader>
        {customer.notes && (
          <CardContent className="pt-4">
             <Separator className="mb-4" />
            <h3 className="font-semibold text-sm mb-1">Notes</h3>
            <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md">{customer.notes}</p>
          </CardContent>
        )}
      </Card>
      
      <InvoiceTable invoices={invoices} title={`Invoices for ${customer.name}`} />
    </div>
  );
}
