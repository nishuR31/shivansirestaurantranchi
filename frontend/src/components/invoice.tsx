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
      className="glass rounded-3xl p-6 print:m-0 print:rounded-none print:border-none print:bg-transparent print:p-4 print:text-black print:shadow-none"
    >
      <header className="mb-6 flex flex-col items-center border-b border-dashed border-border pb-6 text-center print:border-black">
        <h2 className="font-display text-3xl font-bold uppercase tracking-wider print:text-4xl">
          {settings?.name ?? import.meta.env["VITE_BUSINESS_NAME"] ?? "Maa Tara Sweets"}
        </h2>
        {settings?.address && (
          <p className="mt-2 text-sm text-muted-foreground print:text-base print:text-black">
            {settings.address}
          </p>
        )}
        {settings?.phone && (
          <p className="text-sm text-muted-foreground print:text-base print:text-black">
            Ph: {settings.phone}
          </p>
        )}
        {settings?.gst_number && (
          <p className="mt-2 text-sm font-semibold text-muted-foreground print:text-base print:text-black">
            GSTIN: {settings.gst_number}
          </p>
        )}
      </header>

      <div className="mb-6 grid grid-cols-2 gap-4 text-sm text-muted-foreground print:text-base print:text-black">
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
        <div className="col-span-2 mt-4">
          <p>
            <span className="font-semibold text-foreground print:text-black">
              Customer:
            </span>{" "}
            {order.customer_name} • {order.customer_phone}
          </p>
        </div>
      </div>

      <table className="w-full text-base print:text-lg print:text-black">
        <thead className="border-b border-dashed border-border text-left text-sm uppercase tracking-wide text-muted-foreground print:border-black print:text-base print:text-black">
          <tr>
            <th className="py-3">Item</th>
            <th className="py-3 text-center">Qty</th>
            <th className="py-3 text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-border/40 last:border-0 print:border-black/20"
            >
              <td className="py-3">
                <span className="font-medium text-foreground print:text-black">
                  {item.name}
                </span>
                {item.weight_label ? (
                  <span className="text-sm text-muted-foreground print:text-base print:text-black">
                    {" "}
                    ({item.weight_label})
                  </span>
                ) : null}
                {item.instructions ? (
                  <span className="block text-xs italic text-accent print:text-sm print:text-black">
                    {item.instructions}
                  </span>
                ) : null}
              </td>
              <td className="py-3 text-center text-foreground print:text-black">
                {item.quantity}
              </td>
              <td className="py-3 text-right text-foreground print:text-black">
                {money(item.line_total, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-6 space-y-2 border-y border-dashed border-border py-4 text-base print:border-black print:text-lg">
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
        
        <div className="mt-4 flex justify-between pt-4 font-display text-2xl font-bold text-foreground print:text-black">
          <span>Total</span>
          <span>{money(order.total, currency)}</span>
        </div>
      </dl>

      {order.notes ? (
        <p className="mt-4 text-sm italic text-muted-foreground print:text-base print:text-black">
          Note: {order.notes}
        </p>
      ) : null}

      <footer className="mt-8 text-center text-sm text-muted-foreground print:text-base print:text-black">
        <p className="font-semibold text-foreground print:text-black">
          {takeaway
            ? "Thank you for your order!"
            : "Thank you for dining with us!"}
        </p>
        <p className="mt-2">Please visit again.</p>
        <div className="mt-6 border-t border-dashed border-border pt-4 text-xs print:border-black print:text-sm">
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
