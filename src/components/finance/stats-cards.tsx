
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, CreditCard, Users, TrendingUp, TrendingDown, Scale } from "lucide-react";

interface FinanceStatsProps {
    totalRevenue: number;
    totalRefunds: number;
    netRevenue: number;
    totalDebt: number;
}

export function FinanceStats({ totalRevenue, totalRefunds, netRevenue, totalDebt }: FinanceStatsProps) {

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Revenue
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalRevenue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Gross income from all sales
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Refunds</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                    -{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalRefunds)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Value of all processed refunds
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Revenue</CardTitle>
                <Scale className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(netRevenue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Revenue after refunds
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding Debt</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalDebt)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all customers
                </p>
              </CardContent>
            </Card>
        </div>
    )
}
