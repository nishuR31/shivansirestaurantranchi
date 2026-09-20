import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChefHat, Loader2, Printer, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Invoice } from "@/components/invoice";
import { SiteFooter } from "@/components/site-footer";
import { getPublicOrder } from "@/lib/orders.functions";
import { ORDER_FLOW, STATUS_LABEL, type Order } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { getPublicSocket } from "@/lib/socket";
import { useEffect } from "react";

export const Route = createFileRoute("/order/$orderId")({
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search["t"] === "string" ? (search["t"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "Track your order — Maa Tara Sweets" },
      {
        name: "description",
        content: "Live status of your Maa Tara Sweets order, from kitchen to table.",
      },
      { property: "og:title", content: "Track your order — Maa Tara Sweets" },
      {
        property: "og:description",
        content: "Live status of your Maa Tara Sweets order.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderTracking,
});

function OrderTracking() {
  const { orderId } = Route.useParams();
  const { t } = Route.useSearch();
  
  if (!orderId || !t) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-4">
        <div className="glass rounded-3xl p-10 text-center">
          <h1 className="font-display text-2xl font-bold">Order not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This tracking link is invalid or has expired.
          </p>
          <Button asChild variant="hero" className="mt-6 rounded-full">
            <Link to="/menu" search={{ category: undefined }}>
              Back to the menu
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  return <OrderTrackingContent orderId={orderId} token={t} />;
}

function OrderTrackingContent({ orderId, token }: { orderId: string; token: string }) {
  const query = useSuspenseQuery({
    queryKey: ["public-order", orderId, token],
    queryFn: ({ signal }) => getPublicOrder({ id: orderId, token }, { signal }),
  });

  // Subscribe to real-time updates via Socket.IO
  const queryClient = useQueryClient();
  useEffect(() => {
    const socket = getPublicSocket();
    const onConnect = () => {
      // Re-join the room upon connection/reconnection
      socket.emit("track:order", { orderId, token });
      // Authoritative HTTP refetch on reconnect
      void queryClient.invalidateQueries({ queryKey: ["public-order", orderId, token] });
    };

    const onOrderUpdate = () => {
      void queryClient.invalidateQueries({ queryKey: ["public-order", orderId, token] });
    };

    socket.on("connect", onConnect);
    socket.on("order:updated", onOrderUpdate);
    socket.on("order:status_changed", onOrderUpdate);
    socket.on("order:payment_updated", onOrderUpdate);
    
    // Initial emit if already connected
    if (socket.connected) {
      onConnect();
    }
    
    return () => {
      // Leave the room
      socket.emit("untrack:order", { orderId });
      socket.off("connect", onConnect);
      socket.off("order:updated", onOrderUpdate);
      socket.off("order:status_changed", onOrderUpdate);
      socket.off("order:payment_updated", onOrderUpdate);
    };
  }, [orderId, token, queryClient]);

  const payload = query.data;
  if (!payload) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-4">
        <div className="glass rounded-3xl p-10 text-center">
          <h1 className="font-display text-2xl font-bold">Order not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This tracking link is invalid or has expired.
          </p>
          <Button asChild variant="hero" className="mt-6 rounded-full">
            <Link to="/menu" search={{ category: undefined }}>
              Back to the menu
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  const order = payload.order as unknown as Order & { updated_at: string };
  const takeaway = order.table_number == null;
  const status = order.status;
  const cancelled = status === "CANCELLED";
  
  // Exclude SERVED for takeaway orders
  const flow = takeaway ? ORDER_FLOW.filter(s => s !== "SERVED") : ORDER_FLOW;
  const activeIndex = flow.indexOf(status);

  return (
    <main className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="glass animate-rise rounded-3xl p-6 text-center">
          <Badge variant={cancelled ? "destructive" : "gold"}>
            {STATUS_LABEL[status]}
          </Badge>
          <h1 className="mt-3 font-display text-3xl font-bold">{order.order_number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {takeaway ? "Takeaway order" : `Table ${order.table_number}`} • updated{" "}
            {formatTime(order.updated_at)}
          </p>
          {!cancelled ? (
            <p className="mt-3 text-sm text-accent">
              We'll update this page automatically as your food moves along.
            </p>
          ) : null}
        </header>

        {!cancelled ? (
          <ol className="relative space-y-6 pl-10">
            <span className="absolute left-[15px] top-2 h-[calc(100%-1rem)] w-px bg-border" />
            {flow.map((step, index) => {
              const done = index <= activeIndex;
              const current = index === activeIndex;
              return (
                <li key={step} className="relative">
                  <span
                    className={`absolute -left-10 grid size-8 place-items-center rounded-full border transition-colors ${
                      done
                        ? "border-transparent bg-[image:var(--gradient-primary)] text-primary-foreground"
                        : "border-border bg-card text-muted-foreground"
                    } ${current ? "animate-pulse-ring" : ""}`}
                  >
                    {index === 0 ? (
                      <Check className="size-4" />
                    ) : index === 1 ? (
                      <ChefHat className="size-4" />
                    ) : step === "COMPLETED" ? (
                      <Check className="size-4" />
                    ) : (
                      <Utensils className="size-4" />
                    )}
                  </span>
                  <p
                    className={`font-semibold ${done ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {STATUS_LABEL[step]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {current ? "Happening right now" : done ? "Completed" : "Up next"}
                  </p>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="glass rounded-3xl p-6 text-center text-sm text-muted-foreground">
            This order was rejected. Please speak to our staff if you need help.
          </p>
        )}

        {order.payment_status !== "paid" &&
        order.payment_method !== "Cash" &&
        order.payment_method !== "Card" &&
        (payload.settings as { upi_id?: string } | null)?.upi_id ? (
          <p className="glass rounded-3xl p-4 text-center text-sm print:hidden">
            Pay to UPI ID{" "}
            <span className="font-mono text-accent">
              {(payload.settings as { upi_id?: string }).upi_id}
            </span>
          </p>
        ) : null}

        <Invoice order={order} settings={payload.settings as never} />

        <div className="flex flex-wrap justify-center gap-3 print:hidden">
          <Button variant="glass" className="rounded-full" onClick={() => window.print()}>
            <Printer className="size-4" /> Print invoice
          </Button>
          <Button asChild variant="hero" className="rounded-full">
            <Link to="/menu" search={{ category: undefined }}>
              Order more
            </Link>
          </Button>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
