
import { getPayments } from '@/lib/actions/payment';
import { getCustomers } from '@/lib/actions/customers';
import { RecentPaymentsTable } from '@/components/finance/recent-payments-table';
import { FinanceStats } from '@/components/finance/stats-cards';

export default async function FinancePage() {
  const [payments, customers] = await Promise.all([
    getPayments(),
    getCustomers(),
  ]);

  // Calculate stats
  const totalRevenue = payments
    .filter(p => p.type === 'payment')
    .reduce((acc, p) => acc + p.amountPaid, 0);

  const totalRefunds = payments
    .filter(p => p.type === 'refund')
    .reduce((acc, p) => acc + p.amountPaid, 0); // amount is already negative

  const netRevenue = totalRevenue + totalRefunds;

  const totalDebt = customers.reduce((acc, c) => acc + c.debt, 0);


  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Finance Dashboard</h1>
      <FinanceStats
        totalRevenue={totalRevenue}
        totalRefunds={Math.abs(totalRefunds)}
        netRevenue={netRevenue}
        totalDebt={totalDebt}
      />
      <RecentPaymentsTable payments={payments} />
    </div>
  );
}
