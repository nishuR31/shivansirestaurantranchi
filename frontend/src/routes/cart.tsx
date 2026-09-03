import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SiteFooter } from "@/components/site-footer";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import { productImage } from "@/lib/images";
import { settingsQuery, tablesQuery, discountsQuery } from "@/lib/db";
import { placeOrder } from "@/lib/orders.functions";
import { PAYMENT_METHODS } from "@/lib/types";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — Maa Tara Sweets" },
      {
        name: "description",
        content:
          "Review your items, apply a coupon and place your order at Maa Tara Sweets.",
      },
      { property: "og:title", content: "Your cart — Maa Tara Sweets" },
      {
        property: "og:description",
        content: "Review your order and check out at Maa Tara Sweets.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const {
    lines,
    subtotal,
    increment,
    decrement,
    remove,
    tableNumber,
    tableSource,
    setTableNumber,
    clear,
  } = useCart();
  const { data: settings } = useQuery(settingsQuery);
  const { data: tables = [] } = useQuery(tablesQuery);
  const { data: discounts = [] } = useQuery(discountsQuery);
  const navigate = useNavigate();
  const submitOrder = placeOrder;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [coupon, setCoupon] = useState("");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState(PAYMENT_METHODS[0]!);
  const [takeaway, setTakeaway] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tableInput, setTableInput] = useState("");

  const scanned = tableSource === "qr" && tableNumber != null;
  const activeTables = tables.filter((t) => t.is_active);
  const effectiveTable = takeaway
    ? null
    : (tableNumber ?? (tableInput ? Number(tableInput) : null));

  const currency = settings?.currency ?? "₹";
  
  // Calculate local coupon discount
  let discountAmount = 0;
  let discountLabel = null;
  
  const today = new Date().toISOString().slice(0, 10);
  const hour = new Date().getHours();
  // Always evaluate discounts to support auto-applied discounts without a code
  const eligible = discounts.filter((d) => {
    if (!d.is_active) return false;
    if (d.starts_at && d.starts_at.slice(0, 10) > today) return false;
    if (d.ends_at && d.ends_at.slice(0, 10) < today) return false;
    if (subtotal < Number(d.min_order_amount)) return false;
    if (d.start_hour != null && d.end_hour != null && (hour < d.start_hour || hour >= d.end_hour)) return false;
    if (d.coupon_code) {
      if (!coupon.trim()) return false;
      return coupon.trim().toUpperCase() === d.coupon_code.toUpperCase();
    }
    return true;
  });

  for (const d of eligible) {
    const raw = d.type === "flat" ? Number(d.value) : (subtotal * Number(d.value)) / 100;
    const capped = d.max_discount != null ? Math.min(raw, Number(d.max_discount)) : raw;
    if (capped > discountAmount) {
      discountAmount = capped;
      discountLabel = d.name;
    }
  }
  discountAmount = Math.max(0, Math.round(Math.min(discountAmount, subtotal) * 100) / 100);

  const taxable = Math.max(0, subtotal - discountAmount);
  const packing = takeaway ? Number(settings?.packing_charge ?? 0) : 0;
  const delivery = takeaway ? Number(settings?.delivery_charge ?? 0) : 0;
  const estTax = ((taxable * Number(settings?.tax_percent ?? 0)) / 100) | 0;
  const estTotal = taxable + estTax + packing + delivery;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (lines.length === 0) return;
    if (name.trim().length < 2) {
      toast.error("Please enter your name");
      return;
    }
    if (!/^(?:\+?91[\-\s]?)?[6-9]\d{9}$/.test(phone.trim())) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    if (!takeaway && (!effectiveTable || effectiveTable < 1)) {
      toast.error("Please select your table number so we know where to serve");
      return;
    }
    if (!takeaway && effectiveTable && !scanned) setTableNumber(effectiveTable, "manual");

    setSubmitting(true);
    try {
      const result = await submitOrder({
        tableNumber: takeaway ? null : effectiveTable,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        paymentMethod: payment,
        couponCode: coupon.trim() ? coupon.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
        isTakeaway: takeaway,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          weightLabel: l.weightLabel,
          weightGrams: l.weightGrams,
          instructions: l.instructions,
        })),
      });
      clear();
      toast.success(`Order ${result.orderNumber} sent to the kitchen`);
      navigate({
        to: "/order/$orderId",
        params: { orderId: result.id },
        search: { t: result.token },
      });
    } catch (error: any) {
      toast.error(error?.message ?? error?.toString() ?? "Could not place the order");
    } finally {
      setSubmitting(false);
    }
  }

  if (lines.length === 0) {
    return (
      <main className="grid min-h-[70vh] place-items-center px-4">
        <div className="glass rounded-3xl px-10 py-14 text-center">
          <ShoppingBag className="mx-auto size-10 text-muted-foreground" />
          <h1 className="mt-4 font-display text-2xl font-bold">Your cart is empty</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Add something delicious to get started.
          </p>
          <Button asChild variant="hero" className="mt-6 rounded-full">
            <Link to="/menu" search={{ category: undefined }}>
              Browse the menu
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-10 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-3xl font-bold">Your cart</h1>
            {tableNumber && !takeaway ? (
              <Badge variant="gold">
                Table {tableNumber} {scanned ? "• QR scanned" : "• entered manually"}
              </Badge>
            ) : null}
          </header>

          {lines.map((line) => (
            <article key={line.key} className="glass flex gap-4 rounded-3xl p-4">
              <img
                src={productImage(line.imageUrl)}
                alt={line.name}
                loading="lazy"
                className="size-20 shrink-0 rounded-2xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{line.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {line.weightLabel ? `${line.weightLabel} • ` : ""}
                      {money(line.unitPrice, currency)} each
                    </p>
                    {line.instructions.length ? (
                      <p className="mt-1 text-[11px] text-accent">
                        {line.instructions.join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(line.key)}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={`Remove ${line.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="glass"
                      className="size-8"
                      onClick={() => decrement(line.key)}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm font-semibold">
                      {line.quantity}
                    </span>
                    <Button
                      size="icon"
                      variant="glass"
                      className="size-8"
                      onClick={() => increment(line.key)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  <span className="font-display font-bold">
                    {money(line.unitPrice * line.quantity, currency)}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </section>

        <form onSubmit={handleSubmit} className="glass h-fit space-y-4 rounded-3xl p-6">
          <h2 className="font-display text-xl font-bold">Checkout</h2>

          <div className="grid gap-3">
            <div>
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                maxLength={60}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                maxLength={16}
                required
              />
            </div>
            <div>
              <Label htmlFor="coupon">Coupon code (optional)</Label>
              <Input
                id="coupon"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                placeholder="Enter coupon code"
                maxLength={30}
              />
            </div>
            <div>
              <Label htmlFor="notes">Note for the kitchen (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={300}
                rows={2}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border p-3">
            <div>
              <p className="text-sm font-medium">Takeaway / parcel</p>
              <p className="text-xs text-muted-foreground">
                Adds packing and delivery charges
              </p>
            </div>
            <Switch checked={takeaway} onCheckedChange={setTakeaway} />
          </div>

          {!takeaway ? (
            scanned ? (
              <div className="rounded-2xl border border-primary/40 bg-primary/10 p-3">
                <p className="text-sm font-medium">
                  Table {tableNumber} detected from your QR code
                </p>
                <p className="text-xs text-muted-foreground">
                  The kitchen will be told to serve this table.{" "}
                  <button
                    type="button"
                    className="text-accent underline"
                    onClick={() => setTableNumber(null)}
                  >
                    Change table
                  </button>
                </p>
              </div>
            ) : (
              <div>
                <Label htmlFor="table">Table number (required for dine-in)</Label>
                <p className="mb-2 text-xs text-muted-foreground">
                  You didn't scan a table QR code, so please tell us where you're seated.
                </p>
                {activeTables.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {activeTables.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTableInput(String(t.table_number))}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                          tableInput === String(t.table_number)
                            ? "border-primary bg-primary/20"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        Table {t.table_number}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Input
                    id="table"
                    inputMode="numeric"
                    value={tableInput}
                    onChange={(e) =>
                      setTableInput(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))
                    }
                    placeholder="Table number"
                  />
                )}
              </div>
            )
          ) : null}

          <div>
            <Label>Payment method</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPayment(method)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    payment === method
                      ? "border-primary bg-primary/20"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
            {payment !== "Cash" && payment !== "Card" ? (
              <p className="mt-2 text-xs text-muted-foreground">
                UPI payment details are shown on your order page right after you place the
                order.
              </p>
            ) : null}
          </div>

          <dl className="space-y-1.5 border-t border-border pt-4 text-sm">
            <Row label="Subtotal" value={money(subtotal, currency)} />
            {discountAmount > 0 ? (
              <Row label={discountLabel ?? "Discount"} value={`-${money(discountAmount, currency)}`} />
            ) : null}
            <Row
              label={`GST (${settings?.tax_percent ?? 0}%)`}
              value={money(estTax, currency)}
            />
            {packing > 0 ? (
              <Row label="Packing" value={money(packing, currency)} />
            ) : null}
            {delivery > 0 ? (
              <Row label="Delivery" value={money(delivery, currency)} />
            ) : null}
            <div className="flex justify-between pt-2 font-display text-lg font-bold">
              <span>Estimated total</span>
              <span>{money(estTotal, currency)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Discounts and loyalty rewards are applied automatically on the final bill.
            </p>
          </dl>

          <Button
            type="submit"
            variant="hero"
            size="lg"
            className="w-full rounded-full"
            disabled={submitting}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Place order
          </Button>
        </form>
      </div>
      <SiteFooter />
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
