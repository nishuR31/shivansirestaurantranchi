import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { discountsQuery, loyaltyQuery, offersQuery } from "@/lib/db";
import { useDeleteRow, useSaveRow } from "@/lib/admin";
import { PageLoader } from "@/components/page-loader";

export const Route = createFileRoute("/admin/offers")({
  component: OffersManager,
});

function OffersManager() {
  const { data: offers = [], isLoading: oLoad } = useQuery(offersQuery);
  const { data: discounts = [], isLoading: dLoad } = useQuery(discountsQuery);
  const { data: loyalty = [], isLoading: lLoad } = useQuery(loyaltyQuery);

  if (oLoad || dLoad || lLoad) return <PageLoader />;

  const saveOffer = useSaveRow("offers", "offers", "Offer saved");
  const deleteOffer = useDeleteRow("offers", "offers");
  const saveDiscount = useSaveRow("discounts", "discounts", "Coupon saved");
  const deleteDiscount = useDeleteRow("discounts", "discounts");
  const saveLoyalty = useSaveRow("loyalty_rules", "loyalty", "Loyalty rule saved");
  const deleteLoyalty = useDeleteRow("loyalty_rules", "loyalty");

  const [offer, setOffer] = useState({
    title: "",
    description: "",
    discount_percent: 10,
    coupon_code: "",
    starts_at: "",
    ends_at: "",
  });
  const [coupon, setCoupon] = useState({
    name: "",
    type: "percent",
    coupon_code: "",
    value: 10,
    min_order_amount: 0,
  });
  const [rule, setRule] = useState({
    visits_required: 5,
    discount_percent: 10,
    reward_points: 50,
    expiry_days: 90,
  });

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Festival offers</h2>
        <div className="glass grid gap-3 rounded-3xl p-5 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <Label>Title</Label>
            <Input
              value={offer.title}
              onChange={(e) => setOffer({ ...offer, title: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input
              value={offer.description}
              onChange={(e) => setOffer({ ...offer, description: e.target.value })}
            />
          </div>
          <div>
            <Label>Discount %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={offer.discount_percent}
              onChange={(e) =>
                setOffer({
                  ...offer,
                  discount_percent: Math.min(100, Math.max(0, Number(e.target.value))),
                })
              }
            />
          </div>
          <div>
            <Label>Coupon</Label>
            <Input
              value={offer.coupon_code}
              onChange={(e) =>
                setOffer({ ...offer, coupon_code: e.target.value.toUpperCase() })
              }
            />
          </div>
          <div>
            <Label>Starts</Label>
            <Input
              type="date"
              value={offer.starts_at}
              onChange={(e) => setOffer({ ...offer, starts_at: e.target.value })}
            />
          </div>
          <div>
            <Label>Ends</Label>
            <Input
              type="date"
              value={offer.ends_at}
              onChange={(e) => setOffer({ ...offer, ends_at: e.target.value })}
            />
          </div>
          <div className="flex items-end sm:col-span-2">
            <Button
              variant="hero"
              className="w-full rounded-full"
              onClick={() =>
                saveOffer.mutate({
                  ...offer,
                  coupon_code: offer.coupon_code || null,
                  starts_at: offer.starts_at || null,
                  ends_at: offer.ends_at || null,
                  is_active: true,
                })
              }
            >
              <Plus className="size-4" /> Add offer
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {offers.map((o) => (
            <div
              key={o.id}
              className="glass flex items-start justify-between gap-3 rounded-2xl p-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">{o.title}</p>
                <p className="text-xs text-muted-foreground">
                  {o.discount_percent}% • {o.coupon_code ?? "no coupon"} •{" "}
                  {o.starts_at ?? "—"} to {o.ends_at ?? "—"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  checked={o.is_active}
                  onCheckedChange={(v) => saveOffer.mutate({ id: o.id, is_active: v })}
                />
                <Button
                  size="icon"
                  variant="glass"
                  className="size-8 rounded-full"
                  onClick={() => deleteOffer.mutate(o.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Coupons & discounts</h2>
        <div className="glass grid gap-3 rounded-3xl p-5 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <Label>Name</Label>
            <Input
              value={coupon.name}
              onChange={(e) => setCoupon({ ...coupon, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Code</Label>
            <Input
              value={coupon.coupon_code}
              onChange={(e) =>
                setCoupon({ ...coupon, coupon_code: e.target.value.toUpperCase() })
              }
            />
          </div>
          <div>
            <Label>Type</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={coupon.type}
              onChange={(e) => setCoupon({ ...coupon, type: e.target.value })}
            >
              <option value="percent">Percent</option>
              <option value="flat">Flat amount</option>
            </select>
          </div>
          <div>
            <Label>Value</Label>
            <Input
              type="number"
              min="0"
              max={coupon.type === "percent" ? "100" : undefined}
              value={coupon.value}
              onChange={(e) => {
                let val = Number(e.target.value);
                if (coupon.type === "percent") val = Math.min(100, Math.max(0, val));
                setCoupon({ ...coupon, value: val });
              }}
            />
          </div>
          <div>
            <Label>Min order</Label>
            <Input
              type="number"
              value={coupon.min_order_amount}
              onChange={(e) =>
                setCoupon({ ...coupon, min_order_amount: Number(e.target.value) })
              }
            />
          </div>
          <div className="flex items-end sm:col-span-2">
            <Button
              variant="hero"
              className="w-full rounded-full"
              onClick={() =>
                saveDiscount.mutate({
                  ...coupon,
                  coupon_code: coupon.coupon_code || null,
                  is_active: true,
                })
              }
            >
              <Plus className="size-4" /> Add coupon
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {discounts.map((d) => (
            <div
              key={d.id}
              className="glass flex items-start justify-between gap-3 rounded-2xl p-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {d.coupon_code ?? "auto"} •{" "}
                  {d.type === "percent" ? `${d.value}%` : `₹${d.value}`} • min ₹
                  {d.min_order_amount} • used {d.usage_count}×
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  checked={d.is_active}
                  onCheckedChange={(v) => saveDiscount.mutate({ id: d.id, is_active: v })}
                />
                <Button
                  size="icon"
                  variant="glass"
                  className="size-8 rounded-full"
                  onClick={() => deleteDiscount.mutate(d.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Loyalty rules</h2>
        <div className="glass grid gap-3 rounded-3xl p-5 sm:grid-cols-5">
          <div>
            <Label>Visits required</Label>
            <Input
              type="number"
              value={rule.visits_required}
              onChange={(e) =>
                setRule({ ...rule, visits_required: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Discount %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={rule.discount_percent}
              onChange={(e) =>
                setRule({
                  ...rule,
                  discount_percent: Math.min(100, Math.max(0, Number(e.target.value))),
                })
              }
            />
          </div>
          <div>
            <Label>Reward points</Label>
            <Input
              type="number"
              value={rule.reward_points}
              onChange={(e) =>
                setRule({ ...rule, reward_points: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Expiry (days)</Label>
            <Input
              type="number"
              value={rule.expiry_days}
              onChange={(e) => setRule({ ...rule, expiry_days: Number(e.target.value) })}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="hero"
              className="w-full rounded-full"
              onClick={() => saveLoyalty.mutate({ ...rule, is_active: true })}
            >
              <Plus className="size-4" /> Add rule
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {loyalty.map((l) => (
            <div
              key={l.id}
              className="glass flex items-center justify-between gap-3 rounded-2xl p-4"
            >
              <p className="text-sm">
                Every <strong>{l.visits_required}</strong> visits → {l.discount_percent}%
                off + {l.reward_points} points
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  checked={l.is_active}
                  onCheckedChange={(v) => saveLoyalty.mutate({ id: l.id, is_active: v })}
                />
                <Button
                  size="icon"
                  variant="glass"
                  className="size-8 rounded-full"
                  onClick={() => deleteLoyalty.mutate(l.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
