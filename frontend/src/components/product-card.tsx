import { useState } from "react";
import { Clock, Flame, Leaf, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCart } from "@/lib/cart";
import { effectivePrice, money, weightPrice } from "@/lib/format";
import { productImage } from "@/lib/images";
import { COOKING_INSTRUCTIONS, WEIGHT_OPTIONS, type Product } from "@/lib/types";

export function ProductCard({
  product,
  categorySlug,
  currency,
}: {
  product: Product;
  categorySlug?: string | null;
  currency: string;
}) {
  const { addLine } = useCart();
  const [weight, setWeight] = useState(WEIGHT_OPTIONS[1]!);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const unitPrice = product.sold_by_weight
    ? weightPrice(product.price_per_kg ?? 0, weight.grams)
    : effectivePrice(product);
  const hasOffer =
    !product.sold_by_weight && product.offer_price != null && product.offer_price > 0;
  const savingsPercent =
    hasOffer && product.price > 0
      ? Math.round((1 - product.offer_price! / product.price) * 100)
      : 0;

  function toggleInstruction(value: string) {
    setInstructions((prev) =>
      prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value],
    );
  }

  function add() {
    if (isAdding) return;
    setIsAdding(true);
    addLine({
      productId: product.id,
      name: product.name,
      imageUrl: product.image_url,
      unitPrice,
      quantity: 1,
      weightLabel: product.sold_by_weight ? weight.label : null,
      weightGrams: product.sold_by_weight ? weight.grams : null,
      instructions,
    });
    toast.success(`${product.name} added to cart`, {
      description: product.sold_by_weight
        ? weight.label
        : instructions.join(", ") || undefined,
    });
    setInstructions([]);
    setTimeout(() => setIsAdding(false), 600);
  }

  return (
    <article
      className="group card-3d hover:card-3d-hover glass flex flex-col overflow-hidden rounded-3xl animate-fade-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      style={{ position: "relative" }}
      tabIndex={0}
      aria-label={`Product: ${product.name}`}
    >
      {/* Card top shine — glassmorphism layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(1 0 0 / 20%), transparent)",
        }}
      />

      {/* ── Image block ── */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={productImage(product.image_url, categorySlug)}
          alt={product.name}
          loading="lazy"
          width={400}
          height={300}
          className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
          style={{ willChange: "transform" }}
        />
        {/* Gradient overlay — from bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.12_0.012_285)] via-[oklch(0.12_0.012_285/30%)] to-transparent" />

        {/* Badges — veg/spicy/special */}
        <div className="touch-compact absolute left-3 top-3 flex flex-wrap gap-1.5">
          {product.is_spicy ? (
            <Badge
              variant="warning"
              className="animate-scale-in"
              style={{ animationDelay: "0.05s" }}
            >
              <Flame className="mr-1 size-3" aria-hidden="true" />
              Spicy
            </Badge>
          ) : null}
          {product.is_special ? (
            <Badge
              variant="gold"
              className="animate-scale-in"
              style={{ animationDelay: "0.1s" }}
            >
              Today's special
            </Badge>
          ) : null}
          {savingsPercent >= 5 ? (
            <Badge
              variant="gold"
              className="animate-scale-in"
              style={{ animationDelay: "0.15s" }}
            >
              {savingsPercent}% off
            </Badge>
          ) : null}
        </div>

        {/* Sold-out overlay */}
        {!product.is_available ? (
          <div className="absolute inset-0 grid place-items-center bg-background/80 backdrop-blur-sm">
            <Badge variant="destructive" className="text-sm">
              Sold out today
            </Badge>
          </div>
        ) : null}
      </div>

      {/* ── Content block ── */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {/* Name + Rating */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 font-display text-base font-bold leading-snug">
            {product.name}
          </h3>
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent"
            aria-label={`Rating: ${Number(product.rating).toFixed(1)} stars`}
          >
            <Star className="size-3 fill-current" aria-hidden="true" />
            {Number(product.rating).toFixed(1)}
          </span>
        </div>

        {/* Description */}
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {product.description}
        </p>

        {/* Meta — prep time, calories, reviews */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3" aria-hidden="true" />
            <span>{product.prep_time_mins} min</span>
          </span>
          <span>{product.calories} kcal</span>
          <span>{product.review_count} reviews</span>
        </div>

        {/* Weight selector (sweet shop items) */}
        {product.sold_by_weight ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Select weight">
            {WEIGHT_OPTIONS.map((w) => (
              <button
                key={w.label}
                type="button"
                onClick={() => setWeight(w)}
                aria-pressed={weight.label === w.label}
                className={`min-h-[36px] rounded-full border px-3 py-1 text-[11px] font-medium transition-all duration-200 cursor-pointer ${
                  weight.label === w.label
                    ? "border-primary bg-primary/20 text-foreground shadow-[0_0_0_1px_var(--color-primary)]"
                    : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        ) : null}

        {/* Price + Actions */}
        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          {/* Price block */}
          <div className="min-w-0">
            <div className="font-display text-xl font-bold gradient-text-gold">
              {money(unitPrice, currency)}
            </div>
            {hasOffer ? (
              <div className="text-xs text-muted-foreground line-through">
                {money(product.price, currency)}
              </div>
            ) : product.sold_by_weight ? (
              <div className="text-[11px] text-muted-foreground">
                {money(product.price_per_kg ?? 0, currency)}/kg
              </div>
            ) : null}
          </div>

          {/* Action buttons — min 44px touch targets */}
          <div className="flex shrink-0 items-center gap-1.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="glass"
                  size="sm"
                  disabled={!product.is_available}
                  className="rounded-xl text-xs transition-all duration-200 hover:bg-primary/15"
                  aria-label={`Notes - Add cooking instructions${instructions.length ? ` (${instructions.length})` : ""}`}
                >
                  Notes{instructions.length ? ` (${instructions.length})` : ""}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="glass-strong w-56 space-y-2.5 rounded-2xl border-border/50 p-4">
                <p className="text-xs font-semibold text-foreground">
                  Cooking instructions
                </p>
                {COOKING_INSTRUCTIONS.map((option) => (
                  <div key={option} className="flex items-center gap-2.5">
                    <Checkbox
                      id={`${product.id}-${option}`}
                      checked={instructions.includes(option)}
                      onCheckedChange={() => toggleInstruction(option)}
                      className="border-border/60"
                    />
                    <Label
                      htmlFor={`${product.id}-${option}`}
                      className="cursor-pointer text-xs font-normal leading-none"
                    >
                      {option}
                    </Label>
                  </div>
                ))}
              </PopoverContent>
            </Popover>

            <Button
              variant="hero"
              size="sm"
              onClick={add}
              disabled={!product.is_available || isAdding}
              className="rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
              aria-label={`Add ${product.name} to cart`}
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>Add</span>
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
