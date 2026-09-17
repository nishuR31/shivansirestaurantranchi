import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Download, Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { tablesQuery } from "@/lib/db";
import { useDeleteRow, useSaveRow } from "@/lib/admin";
import type { RestaurantTable } from "@/lib/types";
import { PageLoader } from "@/components/page-loader";

export const Route = createFileRoute("/admin/tables")({
  component: TablesManager,
});

/** Generates a single QR lazily — avoids blocking the whole list at once */
function TableCard({
  table,
  onToggle,
  onDelete,
}: {
  table: RestaurantTable;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = `${window.location.origin}/table/${table.table_number}`;
    QRCode.toDataURL(url, { width: 280, margin: 1 }).then((dataUrl) => {
      if (!cancelled) setQr(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [table.table_number]);

  function handleDownload() {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `table-${table.table_number}-qr.png`;
    a.click();
  }

  return (
    <div className="glass flex flex-col items-center gap-3 rounded-3xl p-5 text-center">
      {/* QR code */}
      {qr ? (
        <img
          src={qr}
          alt={`QR code for table ${table.table_number}`}
          className="size-40 rounded-2xl bg-white p-2 shadow-sm"
        />
      ) : (
        <div className="size-40 animate-pulse rounded-2xl bg-muted" />
      )}

      <div>
        <p className="font-display text-lg font-bold">Table {table.table_number}</p>
        <p className="text-xs text-muted-foreground">{table.seats} seats</p>
      </div>

      {/* Controls */}
      <div className="flex w-full items-center justify-between gap-2 border-t border-border/40 pt-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch
            id={`table-active-${table.id}`}
            checked={table.is_active}
            onCheckedChange={onToggle}
          />
          <label htmlFor={`table-active-${table.id}`}>
            {table.is_active ? "Active" : "Inactive"}
          </label>
        </div>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="glass"
            className="size-8 rounded-full"
            title="Download QR"
            disabled={!qr}
            onClick={handleDownload}
          >
            <Download className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="glass"
            className="size-8 rounded-full"
            title="Delete table"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function TablesManager() {
  const { data: tables = [], isLoading } = useQuery(tablesQuery);
  const save = useSaveRow("restaurant_tables", "tables", "Table saved");
  const remove = useDeleteRow("restaurant_tables", "tables");
  const [draft, setDraft] = useState({ table_number: tables.length + 1, seats: 4 });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-xl font-bold">Tables & QR codes</h2>
        <p className="text-sm text-muted-foreground">
          Print or download a QR per table — scanning opens the menu with that table
          pre-selected.
        </p>
      </header>

      {/* Add new table */}
      <div className="glass grid gap-3 rounded-3xl p-5 sm:grid-cols-3">
        <div>
          <Label>Table number</Label>
          <Input
            type="number"
            min={1}
            value={draft.table_number}
            onChange={(e) => setDraft({ ...draft, table_number: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Seats</Label>
          <Input
            type="number"
            min={1}
            value={draft.seats}
            onChange={(e) => setDraft({ ...draft, seats: Number(e.target.value) })}
          />
        </div>
        <div className="flex items-end">
          <Button
            variant="hero"
            className="w-full rounded-full"
            onClick={() =>
              save.mutate(
                { ...draft, is_active: true },
                {
                  onSuccess: () =>
                    setDraft((d) => ({ ...d, table_number: d.table_number + 1 })),
                },
              )
            }
          >
            <Plus className="size-4" /> Add table
          </Button>
        </div>
      </div>

      {/* Table grid — each card generates its QR independently */}
      {tables.length === 0 ? (
        <p className="glass rounded-3xl p-6 text-center text-sm text-muted-foreground">
          No tables yet. Add one above.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tables.map((t) => (
            <TableCard
              key={t.id}
              table={t}
              onToggle={(v) => save.mutate({ id: t.id, is_active: v })}
              onDelete={() => remove.mutate(t.id)}
            />
          ))}
        </div>
      )}

      <Button
        variant="glass"
        className="rounded-full print:hidden"
        onClick={() => window.print()}
      >
        <Printer className="size-4" /> Print all QR codes
      </Button>
    </div>
  );
}
