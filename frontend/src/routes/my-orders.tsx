import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  Gift,
  LogOut,
  Loader2,
  MessageCircle,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Invoice } from "@/components/invoice";
import { SiteFooter } from "@/components/site-footer";
import { STATUS_LABEL, type Order } from "@/lib/types";
import { formatDateTime, money } from "@/lib/format";
import { LoginForm } from "./login";
import { fetchAPI } from "@/lib/db";
import { getCustomerSession, clearCustomerSession, saveCustomerSession, useIsAdmin } from "@/lib/auth";

export const Route = createFileRoute("/my-orders")({
  head: () => ({
    meta: [
      { title: "My orders & loyalty — Maa Tara Sweets" },
      {
        name: "description",
        content:
          "Look up your past Maa Tara Sweets orders, download invoices and check your loyalty points.",
      },
      { property: "og:title", content: "My orders & loyalty — Maa Tara Sweets" },
      {
        property: "og:description",
        content: "Past orders, invoices and loyalty points at Maa Tara Sweets.",
      },
    ],
  }),
  component: MyOrders,
});

// Replaced custom login panels with Unified AuthForm from login.tsx

// ── Main page component ────────────────────────────────────────────────────
function MyOrders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const { user, checking } = useIsAdmin();
  const customerSession = getCustomerSession();
  const effectiveIdentifier = customerSession?.phone ?? user?.phone ?? user?.email;

  const { data: result, isLoading } = useQuery({
    queryKey: ["customer-profile", effectiveIdentifier],
    queryFn: async ({ signal }) => {
      if (!effectiveIdentifier) return null;
      const res = await fetchAPI<any>(
        `/customer-profile?phone=${encodeURIComponent(effectiveIdentifier)}`,
        { signal },
      );
      return res as { customer: any; orders: Order[] };
    },
    enabled: !!effectiveIdentifier && !checking,
    retry: false,
    // refetchInterval: POLL_INTERVAL,
  });

  function handleLoginSuccess({
    customer,
    profileToken,
    phone,
  }: {
    customer: any;
    profileToken: string;
    phone: string;
  }) {
    saveCustomerSession({ phone, name: customer.name ?? phone, profileToken });
    toast.success(`Welcome back, ${customer.name ?? ""}!`);
    void queryClient.invalidateQueries({ queryKey: ["customer-profile", phone] });
  }

  function handleSignOut() {
    clearCustomerSession();
    fetchAPI("/auth/logout", { method: "POST" }).catch(() => { });
    queryClient.invalidateQueries({ queryKey: ["auth_me"] });
    navigate({ to: "/login", replace: true });
    toast.success("Signed out");
  }

  return (
    <main className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-3xl font-bold sm:text-4xl">My orders</h1>
            {!effectiveIdentifier && (
              <p className="text-sm text-muted-foreground">
                Sign in to view your order history, invoices and loyalty rewards.
              </p>
            )}
          </div>
          {effectiveIdentifier && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {effectiveIdentifier}
              </span>
              <Button
                variant="glass"
                size="sm"
                className="rounded-full"
                onClick={handleSignOut}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          )}
        </header>

        {/* Unauthenticated: WhatsApp / Email tabbed login */}
        {!effectiveIdentifier && (
          <div className="flex justify-center">
            <LoginForm onSuccessProp={handleLoginSuccess} />
          </div>
        )}

        {/* Loading state */}
        {effectiveIdentifier && (isLoading || checking) && (
          <div className="glass flex items-center justify-center gap-3 rounded-3xl p-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading your orders…</p>
          </div>
        )}

        {/* Authenticated: order results */}
        {result ? (
          <>
            {/* Profile banner */}
            <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-4">
              <div className="flex items-center gap-3">
                <UserCircle2 className="size-5 text-accent shrink-0" />
                <p className="text-sm">
                  <span className="font-medium">View your full profile</span>{" "}
                  <span className="text-muted-foreground">
                    — edit your name, birthday & address.
                  </span>
                </p>
              </div>
              <Link to="/profile">
                <Button variant="hero" size="sm" className="rounded-full">
                  My profile →
                </Button>
              </Link>
            </div>

            {/* Loyalty stats */}
            <section className="glass grid gap-4 rounded-3xl p-6 sm:grid-cols-3">
              <Stat label="Guest" value={result.customer.name} />
              <Stat label="Visits" value={String(result.customer.visits)} />
              <Stat
                label="Loyalty points"
                value={String(result.customer.reward_points)}
                hint={<Gift className="size-4 text-accent" />}
              />
            </section>

            {/* Empty state */}
            {result.orders.length === 0 && (
              <p className="glass rounded-3xl p-6 text-center text-sm text-muted-foreground">
                No orders found yet.{" "}
                <Link
                  to="/menu"
                  search={{ category: undefined }}
                  className="text-accent underline"
                >
                  Start an order
                </Link>
                .
              </p>
            )}

            {/* Order list */}
            <section className="space-y-3">
              {result.orders.map((order: any) => (
                <article key={order.id} className="glass rounded-3xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(order.created_at)} •{" "}
                        {order.table_number == null
                          ? "Takeaway"
                          : `Table ${order.table_number}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={order.status === "rejected" ? "destructive" : "glass"}
                      >
                        {STATUS_LABEL[order.status as keyof typeof STATUS_LABEL]}
                      </Badge>
                      <span className="font-display font-bold">{money(order.total)}</span>
                      <Button
                        variant="glass"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setOpenId(openId === order.id ? null : order.id)}
                      >
                        {openId === order.id ? "Hide bill" : "View bill"}
                      </Button>
                    </div>
                  </div>
                  {openId === order.id && (
                    <div className="mt-4">
                      <Invoice order={order} settings={null} />
                    </div>
                  )}
                </article>
              ))}
            </section>
          </>
        ) : null}
      </div>
      <SiteFooter />
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {label} {hint}
      </p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
