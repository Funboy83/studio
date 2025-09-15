import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RecentSale } from '@/lib/types';

interface RecentSalesProps {
    recentSales: RecentSale[];
}

export function RecentSales({ recentSales }: RecentSalesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Sales</CardTitle>
        <CardDescription>Your 5 most recent sales.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {recentSales.map((sale) => (
            <div key={sale.id} className="flex items-center">
              <Avatar className="h-9 w-9">
                <AvatarImage src={`https://picsum.photos/seed/${sale.id}/40/40`} alt="Avatar" />
                <AvatarFallback>{sale.customerName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="ml-4 space-y-1">
                <p className="text-sm font-medium leading-none">{sale.customerName}</p>
                <p className="text-sm text-muted-foreground">{sale.customerEmail}</p>
              </div>
              <div className="ml-auto font-medium">${sale.amount.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
