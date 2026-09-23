import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { updateOrderStatus } from "@/lib/notify.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ReceiptText,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Invoice } from "@/components/invoice";
import { PageLoader } from "@/components/page-loader";
import { notificationsQuery, ordersQuery, settingsQuery } from "@/lib/db";
import { formatTime, isToday, money } from "@/lib/format";
import { STATUS_LABEL, type Order, type OrderStatus } from "@/lib/types";
import { fetchAPI } from "@/lib/db";

export const Route = createFileRoute("/admin/")({
  component: LiveOrders,
});

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "PREPARED",
  PREPARED: "SERVED",
  SERVED: "COMPLETED",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function revenueOf(orders: Order[]) {
  return orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((sum, o) => sum + Number(o.total), 0);
}

function LiveOrders() {
  const { data: orders = [], isLoading: loadingOrders } = useQuery(ordersQuery);
  const { data: settings, isLoading: loadingSettings } = useQuery(settingsQuery);
  const { data: notifications = [], isLoading: loadingNotifs } = useQuery(notificationsQuery);
  const qc = useQueryClient();
  const [openBill, setOpenBill] = useState<string | null>(null);
  const [filter, setFilter] = useState<"live" | "today" | "unread">("live");
  const changeStatus = updateOrderStatus;

  const currency = settings?.currency ?? "₹";
  const todays = orders.filter((o) => isToday(o.created_at));
  const revenue = revenueOf(todays);
  const live = orders.filter((o) =>
    ["CONFIRMED", "PREPARING", "PREPARED", "SERVED"].includes(o.status),
  );
  const unread = orders.filter((o) => o.status === "PENDING");

  const displayedOrders =
    filter === "today" ? todays : filter === "unread" ? unread : live;

  if (loadingOrders || loadingSettings || loadingNotifs) {
    return <PageLoader />;
  }

  async function setStatus(order: Order, status: OrderStatus) {
    try {
      await changeStatus({ orderId: order.id, status });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update status");
      return;
    }
    toast.success(
      `${order.order_number} → ${STATUS_LABEL[status]} · WhatsApp update sent`,
    );
    void qc.invalidateQueries({ queryKey: ["orders"] });
  }

  async function setPaid(order: Order) {
    try {
      await fetchAPI(`/orders/${order.id}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" })
      });
      void qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <Kpi
          icon={ReceiptText}
          label="Orders today"
          value={String(todays.length)}
          active={filter === "today"}
          onClick={() => setFilter("today")}
        />
        <Kpi
          icon={TrendingUp}
          label="Live orders"
          value={String(live.length)}
          active={filter === "live"}
          onClick={() => setFilter("live")}
        />
        <Kpi
          icon={Bell}
          label="Unread alerts"
          value={String(unread.length)}
          active={filter === "unread"}
          onClick={() => setFilter("unread")}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">
          {filter === "today"
            ? "Today's Orders"
            : filter === "unread"
              ? "Pending Orders"
              : "Live kitchen board"}
        </h2>
        {displayedOrders.length === 0 ? (
          <p className="glass rounded-3xl p-6 text-sm text-muted-foreground">
            No orders found for this filter.
          </p>
        ) : null}
        {displayedOrders.map((order) => {
          const isTakeaway = order.table_number == null;
          const next = isTakeaway && order.status === "PREPARED" ? "COMPLETED" : NEXT[order.status];
          return (
            <article key={order.id} className="glass animate-rise rounded-3xl p-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm">{order.order_number}</span>
                    <Badge variant={order.status === "PENDING" ? "gold" : "glass"}>
                      {STATUS_LABEL[order.status]}
                    </Badge>
                    <Badge variant="glass">
                      {order.table_number == null
                        ? "Takeaway"
                        : `Table ${order.table_number}`}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(order.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {order.customer_name} • {order.customer_phone} •{" "}
                    {order.payment_method} ({order.payment_status})
                  </p>
                  <ul className="mt-3 space-y-1 text-sm">
                    {(order.order_items ?? []).map((item) => (
                      <li key={item.id} className="flex justify-between gap-3">
                        <span>
                          {item.quantity} × {item.name}
                          {item.weight_label ? ` (${item.weight_label})` : ""}
                          {item.instructions ? (
                            <span className="text-accent"> — {item.instructions}</span>
                          ) : null}
                        </span>
                        <span className="text-muted-foreground">
                          {money(item.line_total, currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {order.notes ? (
                    <p className="mt-2 text-xs text-accent">Note: {order.notes}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="font-display text-xl font-bold">
                    {money(order.total, currency)}
                  </span>
                  {next ? (
                    <Button
                      size="sm"
                      variant="hero"
                      className="rounded-full"
                      onClick={() => setStatus(order, next)}
                    >
                      Mark {STATUS_LABEL[next].toLowerCase()}
                    </Button>
                  ) : null}
                  {order.status === "PENDING" ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="rounded-full"
                      onClick={() => setStatus(order, "CANCELLED")}
                    >
                      Reject
                    </Button>
                  ) : null}
                  {order.payment_status !== "paid" ? (
                    <Button
                      size="sm"
                      variant="glass"
                      className="rounded-full"
                      onClick={() => setPaid(order)}
                    >
                      Mark paid
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="glass"
                    className="rounded-full"
                    onClick={() => setOpenBill(openBill === order.id ? null : order.id)}
                  >
                    {openBill === order.id ? "Hide bill" : "Bill"}
                  </Button>
                </div>
              </div>
              {openBill === order.id ? (
                <div className="mt-4">
                  <Invoice order={order} settings={settings ?? null} />
                  <Button
                    variant="glass"
                    size="sm"
                    className="mt-3 rounded-full print:hidden"
                    onClick={() => window.print()}
                  >
                    Print
                  </Button>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Recent history</h2>
        <div className="glass overflow-x-auto rounded-3xl p-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2">Order</th>
                <th className="py-2">Guest</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 20).map((order) => (
                <tr key={order.id} className="border-t border-border/60">
                  <td className="py-2 font-mono text-xs">{order.order_number}</td>
                  <td className="py-2">{order.customer_name}</td>
                  <td className="py-2 text-muted-foreground">
                    {STATUS_LABEL[order.status]}
                  </td>
                  <td className="py-2 text-right">{money(order.total, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`glass card-3d hover:card-3d-hover rounded-3xl p-5 text-left w-full transition-colors ${active
          ? "border-primary/50 bg-primary/10 shadow-[0_0_20px_rgba(var(--primary-rgb,124,58,237),0.15)]"
          : ""
        }`}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4 text-accent" /> {label}
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </button>
  );
}
