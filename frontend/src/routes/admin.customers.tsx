import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { customersQuery, reviewsQuery, fetchAPI } from "@/lib/db";
import { useDeleteRow, useSaveRow } from "@/lib/admin";
import { money } from "@/lib/format";
import { PageLoader } from "@/components/page-loader";

export const Route = createFileRoute("/admin/customers")({
  component: CustomersManager,
});

function CustomersManager() {
  const { data: customers = [], isLoading: loadingCust } = useQuery(customersQuery);
  const { data: reviews = [], isLoading: loadingRev } = useQuery(reviewsQuery);

  if (loadingCust || loadingRev) return <PageLoader />;

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const sortedCustomers = useMemo(() => {
    let sortable = [...customers];
    if (sortConfig !== null) {
      sortable.sort((a: any, b: any) => {
        let aVal = a[sortConfig.key] ?? "";
        let bVal = b[sortConfig.key] ?? "";

        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortConfig.direction === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [customers, sortConfig]);

  const requestSort = (key: string) => {
    let direction: "asc" | "desc" = "desc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey)
      return <ArrowUpDown className="inline ml-1 size-3 opacity-50" />;
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="inline ml-1 size-3" />
    ) : (
      <ArrowDown className="inline ml-1 size-3" />
    );
  };
  const [busy, setBusy] = useState<string | null>(null);
  const qc = useQueryClient();

  async function togglePublish(review: any) {
    setBusy(review.id);
    try {
      await fetchAPI(`/reviews/${review.id}/publish`, {
        method: "PATCH",
        body: JSON.stringify({ is_published: !review.is_published }),
        headers: { "Content-Type": "application/json" },
      });
      toast.success(review.is_published ? "Review hidden" : "Review published");
      void qc.invalidateQueries({ queryKey: ["reviews"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update review");
    } finally {
      setBusy(null);
    }
  }

  async function deleteReview(review: any) {
    if (!confirm(`Delete this review? This cannot be undone.`)) return;
    setBusy(review.id);
    try {
      await fetchAPI(`/reviews/${review.id}`, { method: "DELETE" });
      toast.success("Review deleted");
      void qc.invalidateQueries({ queryKey: ["reviews"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not delete review");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Customers & loyalty</h2>
        <div className="glass overflow-x-auto rounded-3xl p-4">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground select-none">
              <tr>
                <th
                  className="py-2 cursor-pointer hover:text-foreground"
                  onClick={() => requestSort("name")}
                >
                  Name <SortIcon columnKey="name" />
                </th>
                <th
                  className="py-2 cursor-pointer hover:text-foreground"
                  onClick={() => requestSort("phone")}
                >
                  Phone <SortIcon columnKey="phone" />
                </th>
                <th
                  className="py-2 text-center cursor-pointer hover:text-foreground"
                  onClick={() => requestSort("visits")}
                >
                  Visits <SortIcon columnKey="visits" />
                </th>
                <th
                  className="py-2 text-center cursor-pointer hover:text-foreground"
                  onClick={() => requestSort("reward_points")}
                >
                  Points <SortIcon columnKey="reward_points" />
                </th>
                <th
                  className="py-2 text-right cursor-pointer hover:text-foreground"
                  onClick={() => requestSort("total_spend")}
                >
                  Total spend <SortIcon columnKey="total_spend" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedCustomers.map((c) => (
                <tr key={c.id} className="border-t border-border/60">
                  <td className="py-2">{c.name}</td>
                  <td className="py-2 text-muted-foreground">{c.phone}</td>
                  <td className="py-2 text-center">{c.visits}</td>
                  <td className="py-2 text-center">{c.reward_points}</td>
                  <td className="py-2 text-right">{money(c.total_spend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Reviews</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {reviews.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {r.customer_name} • {r.rating}★
                  </p>
                  <p className="text-sm text-muted-foreground">{r.comment}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={r.is_published}
                    onCheckedChange={(v) => togglePublish(r)}
                  />
                  <Button
                    size="icon"
                    variant="glass"
                    className="size-8 rounded-full"
                    disabled={busy === r.id}
                    onClick={() => deleteReview(r)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
