import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, CalendarDays, IndianRupee, Users, ShoppingBag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ordersQuery, settingsQuery } from "@/lib/db";
import { isToday, isThisMonth, isThisYear, isSameDay, money } from "@/lib/format";
import type { Order } from "@/lib/types";

export const Route = createFileRoute("/admin/reports")({
  component: Reports,
});

function Reports() {
  const { data: orders = [] } = useQuery(ordersQuery);
  const { data: settings } = useQuery(settingsQuery);
  const currency = settings?.currency ?? "₹";
  const [customDate, setCustomDate] = useState("");

  const valid = orders.filter((o) => o.status !== "CANCELLED");
  const todays = valid.filter((o) => isToday(o.created_at));

  const revenueOf = (list: Order[]) => list.reduce((sum, o) => sum + Number(o.total), 0);
  const revenue = revenueOf(todays.filter((o) => o.status !== "CANCELLED"));

  const analytics = useMemo(() => {
    const monthOrders = valid.filter((o) => isThisMonth(o.created_at));
    const monthRevenue = revenueOf(monthOrders);

    const yearOrders = valid.filter((o) => isThisYear(o.created_at));
    const yearRevenue = revenueOf(yearOrders);

    // Custom date orders
    let customOrders: Order[] = [];
    if (customDate) {
      customOrders = valid.filter((o) => isSameDay(o.created_at, customDate));
    }
    const customRevenue = revenueOf(customOrders);

    // Payment method breakdown (today)
    const paymentBreakdown: Record<string, number> = {};
    const validToday = todays.filter((o) => o.status !== "CANCELLED");
    for (const o of validToday) {
      const method = o.payment_method || "Unknown";
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + Number(o.total);
    }

    // Top customers (today)
    const customerSpend: Record<string, { name: string; phone: string; total: number; count: number }> = {};
    for (const o of validToday) {
      const key = o.customer_phone || o.customer_name;
      if (!customerSpend[key]) {
        customerSpend[key] = { name: o.customer_name, phone: o.customer_phone, total: 0, count: 0 };
      }
      customerSpend[key].total += Number(o.total);
      customerSpend[key].count += 1;
    }
    const topCustomers = Object.values(customerSpend)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Top items (today)
    const itemSales: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const o of validToday) {
      for (const item of o.order_items ?? []) {
        if (!itemSales[item.name]) {
          itemSales[item.name] = { name: item.name, qty: 0, revenue: 0 };
        }
        itemSales[item.name]!.qty += item.quantity;
        itemSales[item.name]!.revenue += Number(item.line_total);
      }
    }
    const topItems = Object.values(itemSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    return {
      monthRevenue,
      monthOrders: monthOrders.length,
      yearRevenue,
      yearOrders: yearOrders.length,
      customRevenue,
      customOrders: customOrders.length,
      paymentBreakdown,
      topCustomers,
      topItems,
    };
  }, [valid, todays, customDate]);

  const downloadReport = () => {
    import("xlsx").then((XLSX) => {
      const rows = valid.map((o) => ({
        "Order ID": o.id,
        Date: new Date(o.created_at).toLocaleString(),
        Status: o.status,
        Total: o.total,
        "Customer Phone": o.customer_phone || "",
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Reports");
      XLSX.writeFile(workbook, `reports-${new Date().toISOString().split("T")[0]}.xlsx`);
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">Revenue & Reports</h2>
          <p className="text-sm text-muted-foreground">
            Sales performance and analytics.
          </p>
        </div>
        <Button variant="hero" className="rounded-full" onClick={downloadReport}>
          <Download className="mr-2 size-4" /> Download Report
        </Button>
      </header>

      {/* Revenue Analytics Block */}
      <section className="space-y-4 animate-rise">
        {/* Revenue cards row */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="glass rounded-3xl p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <IndianRupee className="size-4 text-accent" /> Today
            </div>
            <p className="mt-2 font-display text-2xl font-bold">
              {money(revenue, currency)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {todays.filter((o) => o.status !== "CANCELLED").length} orders
            </p>
          </div>
          <div className="glass rounded-3xl p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="size-4 text-accent" /> This month
            </div>
            <p className="mt-2 font-display text-2xl font-bold">
              {money(analytics.monthRevenue, currency)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.monthOrders} orders
            </p>
          </div>
          <div className="glass rounded-3xl p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="size-4 text-accent" /> This year
            </div>
            <p className="mt-2 font-display text-2xl font-bold">
              {money(analytics.yearRevenue, currency)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.yearOrders} orders
            </p>
          </div>
          <div className="glass rounded-3xl p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="size-4 text-accent" /> Custom date
            </div>
            <Input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="mt-2 h-8"
            />
            {customDate && (
              <p className="mt-1 font-display text-lg font-bold">
                {money(analytics.customRevenue, currency)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({analytics.customOrders} orders)
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Payment breakdown + top customers */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Payment methods */}
          <div className="glass rounded-3xl p-5">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold mb-3">
              <IndianRupee className="size-4 text-accent" /> Payment Breakdown (Today)
            </h3>
            {Object.keys(analytics.paymentBreakdown).length === 0 ? (
              <p className="text-xs text-muted-foreground">No orders today</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(analytics.paymentBreakdown).map(([method, total]) => (
                  <div key={method} className="flex justify-between text-sm">
                    <span className="text-muted-foreground capitalize">{method}</span>
                    <span className="font-medium">{money(total, currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top customers */}
          <div className="glass rounded-3xl p-5">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold mb-3">
              <Users className="size-4 text-accent" /> Top Customers (Today)
            </h3>
            {analytics.topCustomers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No orders today</p>
            ) : (
              <div className="space-y-2">
                {analytics.topCustomers.map((c, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <div>
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {c.count} order{c.count > 1 ? "s" : ""}
                      </span>
                    </div>
                    <span className="font-medium">{money(c.total, currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top items */}
        <div className="glass rounded-3xl p-5">
          <h3 className="flex items-center gap-2 font-display text-sm font-bold mb-3">
            <ShoppingBag className="size-4 text-accent" /> Top Selling Items (Today)
          </h3>
          {analytics.topItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">No items sold today</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {analytics.topItems.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between rounded-xl border border-border/40 px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ×{item.qty}
                    </span>
                  </div>
                  <span className="font-medium text-accent">
                    {money(item.revenue, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="glass overflow-x-auto rounded-3xl p-4 mt-6">
        <h3 className="mb-3 font-display text-lg font-bold">Recent Transactions</h3>
        <table className="w-full min-w-[600px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2">Order #</th>
              <th className="py-2">Date</th>
              <th className="py-2">Customer</th>
              <th className="py-2">Status</th>
              <th className="py-2">Payment</th>
              <th className="py-2 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {valid
              .slice()
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 20) // Show last 20 transactions
              .map((order) => (
                <tr key={order.id} className="border-t border-border/60">
                  <td className="py-2 font-mono">{order.order_number}</td>
                  <td className="py-2">{new Date(order.created_at).toLocaleString()}</td>
                  <td className="py-2">{order.customer_name || "Guest"}</td>
                  <td className="py-2">
                    <Badge variant="glass" className="scale-90 origin-left">
                      {order.status}
                    </Badge>
                  </td>
                  <td className="py-2">
                    {order.payment_method} ({order.payment_status})
                  </td>
                  <td className="py-2 text-right font-medium text-accent">
                    {money(Number(order.total), currency)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
