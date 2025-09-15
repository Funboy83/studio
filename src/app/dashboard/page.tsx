import { StatsCards } from '@/components/dashboard/stats-cards';
import { SalesChart } from '@/components/dashboard/sales-chart';
import { RecentSales } from '@/components/dashboard/recent-sales';
import { getDashboardStats } from '@/lib/actions/invoice';
import { getCustomers } from '@/lib/actions/customers';

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <StatsCards 
            totalRevenue={stats.totalRevenue}
            salesCount={stats.salesCount}
            newCustomers={stats.newCustomers}
            outstandingDebt={stats.outstandingDebt}
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <div className="lg:col-span-4">
                <SalesChart salesData={stats.salesData} />
            </div>
            <div className="lg:col-span-3">
                <RecentSales recentSales={stats.recentSales} />
            </div>
        </div>
    </div>
  );
}
