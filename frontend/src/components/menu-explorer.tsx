import { Suspense, useMemo, useState, useDeferredValue } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/product-card";
import { categoriesQuery, productsQuery, settingsQuery } from "@/lib/db";


interface MenuExplorerProps {
  initialCategory?: string;
  /** Called when the user changes category — parent can sync to URL */
  onCategoryChange?: (slug: string) => void;
}

export function MenuExplorer(props: MenuExplorerProps) {
  return (
    <Suspense fallback={<MenuExplorerSkeleton />}>
      <MenuExplorerContent {...props} />
    </Suspense>
  );
}

function MenuExplorerContent({ initialCategory, onCategoryChange }: MenuExplorerProps) {
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(initialCategory ?? "all");

  const currency = settings?.currency ?? "₹";

  function handleCategoryChange(slug: string) {
    setCategory(slug);
    onCategoryChange?.(slug);
  }

  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(() => {
    const list = products ?? [];
    const term = deferredSearch.trim().toLowerCase();
    return list.filter((p) => {
      const cat = categories.find((c) => c.id === p.category_id);
      if (category !== "all" && cat?.slug !== category) return false;
      if (term && !`${p.name} ${p.description}`.toLowerCase().includes(term))
        return false;
      return true;
    });
  }, [products, categories, category, search]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-11 rounded-full pl-9"
            maxLength={60}
          />
        </div>
      </div>

      {/* Category filter bar — horizontal scrollable */}
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0"
        role="group"
        aria-label="Filter by category"
      >
        <button
          type="button"
          onClick={() => handleCategoryChange("all")}
          className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition-all duration-150 ${
            category === "all"
              ? "border-primary bg-primary/20 text-foreground shadow-[0_0_10px_rgba(var(--primary-rgb,124,58,237),0.2)]"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
          }`}
        >
          Everything
        </button>
        {categories
          .filter((c) => c.is_active)
          .map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleCategoryChange(c.slug)}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition-all duration-150 ${
                category === c.slug
                  ? "border-primary bg-primary/20 text-foreground shadow-[0_0_10px_rgba(var(--primary-rgb,124,58,237),0.2)]"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {c.name}
            </button>
          ))}
      </div>

      {filtered.length === 0 ? (
        <p className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">
          Nothing matches that search yet. Try another dish or category.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              currency={currency}
              categorySlug={categories.find((c) => c.id === p.category_id)?.slug ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MenuExplorerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <Skeleton className="h-11 rounded-full shimmer" />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full shimmer" />
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-80 rounded-3xl shimmer" />
        ))}
      </div>
    </div>
  );
}
