
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building, Store } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full -mt-20">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight">Welcome to CellSmart</h1>
        <p className="text-xl text-muted-foreground mt-2">Please select a business area to continue.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <Link href="/dashboard/wholesale" passHref>
          <Card className="hover:bg-accent hover:shadow-lg transition-all cursor-pointer h-full flex flex-col">
            <CardHeader className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Building className="w-20 h-20 text-primary mb-4" />
              <CardTitle className="text-3xl">Wholesale</CardTitle>
              <CardDescription className="text-base mt-2">
                Manage bulk inventory, wholesale customers, and large-scale orders.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/dashboard/retail" passHref>
          <Card className="hover:bg-accent hover:shadow-lg transition-all cursor-pointer h-full flex flex-col">
            <CardHeader className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Store className="w-20 h-20 text-primary mb-4" />
              <CardTitle className="text-3xl">Retail</CardTitle>
              <CardDescription className="text-base mt-2">
                Handle individual sales, customer management, and point-of-sale operations.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
