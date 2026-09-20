import { money, formatDateTime } from "@/lib/format";
import type { Order, RestaurantSettings } from "@/lib/types";

export function Invoice({
  order,
  settings,
}: {
  order: Order;
  settings: Partial<RestaurantSettings> | null;
}) {
  const currency = settings?.currency ?? "₹";
  const items = order.order_items ?? [];
  const takeaway = order.table_number == null;

  return (
    <div
      id="invoice"
      className="glass rounded-3xl p-6 print:m-0 print:w-[80mm] print:rounded-none print:border-none print:bg-transparent print:p-2 print:text-black print:shadow-none"
    >
      <header className="mb-4 flex flex-col items-center border-b border-dashed border-border pb-4 text-center print:border-black">
        <h2 className="font-display text-xl font-bold uppercase tracking-wider print:text-xl">
          {settings?.name ?? import.meta.env["VITE_BUSINESS_NAME"] ?? "Maa Tara Sweets"}
        </h2>
        {settings?.address && (
          <p className="mt-1 text-xs text-muted-foreground print:text-[10px] print:text-black">
            {settings.address}
          </p>
        )}
        {settings?.phone && (
          <p className="text-xs text-muted-foreground print:text-[10px] print:text-black">
            Ph: {settings.phone}
          </p>
        )}
        {settings?.gst_number && (
          <p className="mt-1 text-xs font-semibold text-muted-foreground print:text-[10px] print:text-black">
            GSTIN: {settings.gst_number}
          </p>
        )}
      </header>

      <div className="mb-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground print:text-[10px] print:text-black">
        <div>
          <p>
            <span className="font-semibold text-foreground print:text-black">No:</span>{" "}
            {order.order_number}
          </p>
          {(order as any).bill_id && (
            <p>
              <span className="font-semibold text-foreground print:text-black">
                Bill:
              </span>{" "}
              {(order as any).bill_id}
            </p>
          )}
          <p>
            <span className="font-semibold text-foreground print:text-black">Date:</span>{" "}
            {formatDateTime(order.created_at)}
          </p>
        </div>
        <div className="text-right">
          <p>
            <span className="font-semibold text-foreground print:text-black">Type:</span>{" "}
            {takeaway ? "Takeaway" : `Table ${order.table_number}`}
          </p>
          <p>
            <span className="font-semibold text-foreground print:text-black">Pay:</span>{" "}
            {order.payment_method}
          </p>
          <p>
            <span className="font-semibold text-foreground print:text-black">
              Status:
            </span>{" "}
            {order.payment_status}
          </p>
        </div>
        <div className="col-span-2 mt-2">
          <p>
            <span className="font-semibold text-foreground print:text-black">
              Customer:
            </span>{" "}
            {order.customer_name} • {order.customer_phone}
          </p>
        </div>
      </div>

      <table className="w-full text-sm print:text-[11px] print:text-black">
        <thead className="border-b border-dashed border-border text-left text-xs uppercase tracking-wide text-muted-foreground print:border-black print:text-[10px] print:text-black">
          <tr>
            <th className="py-2">Item</th>
            <th className="py-2 text-center">Qty</th>
            <th className="py-2 text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-border/40 last:border-0 print:border-black/20"
            >
              <td className="py-2">
                <span className="font-medium text-foreground print:text-black">
                  {item.name}
                </span>
                {item.weight_label ? (
                  <span className="text-xs text-muted-foreground print:text-[9px] print:text-black">
                    {" "}
                    ({item.weight_label})
                  </span>
                ) : null}
                {item.instructions ? (
                  <span className="block text-[10px] italic text-accent print:text-[9px] print:text-black">
                    {item.instructions}
                  </span>
                ) : null}
              </td>
              <td className="py-2 text-center text-foreground print:text-black">
                {item.quantity}
              </td>
              <td className="py-2 text-right text-foreground print:text-black">
                {money(item.line_total, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-4 space-y-1 border-y border-dashed border-border py-3 text-sm print:border-black print:text-[11px]">
        <Line label="Subtotal" value={money(order.subtotal, currency)} />
        {order.discount > 0 ? (
          <Line
            label={
              order.discount_label ? `Discount (${order.discount_label})` : "Discount"
            }
            value={`-${money(order.discount, currency)}`}
          />
        ) : null}
        <Line
          label={`GST (${settings?.tax_percent ?? 0}%)`}
          value={money(order.tax, currency)}
        />
        {order.packing_charge > 0 ? (
          <Line label="Packing" value={money(order.packing_charge, currency)} />
        ) : null}
        {order.delivery_charge > 0 ? (
          <Line label="Delivery" value={money(order.delivery_charge, currency)} />
        ) : null}
        
        <div className="mt-2 flex justify-between pt-2 font-display text-lg font-bold text-foreground print:text-black">
          <span>Total</span>
          <span>{money(order.total, currency)}</span>
        </div>
      </dl>

      {order.notes ? (
        <p className="mt-3 text-xs italic text-muted-foreground print:text-[10px] print:text-black">
          Note: {order.notes}
        </p>
      ) : null}

      <footer className="mt-6 text-center text-xs text-muted-foreground print:text-[10px] print:text-black">
        <p className="font-semibold text-foreground print:text-black">
          {takeaway
            ? "Thank you for your order!"
            : "Thank you for dining with us!"}
        </p>
        <p className="mt-1">Please visit again.</p>
        <div className="mt-4 border-t border-dashed border-border pt-2 text-[9px] print:border-black print:text-[8px]">
          <p>This is a computer generated invoice.</p>
          <p>All disputes are subject to local jurisdiction only.</p>
        </div>
      </footer>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground print:text-black">
      <dt>{label}</dt>
      <dd className="font-medium text-foreground print:text-black">{value}</dd>
    </div>
  );
}
