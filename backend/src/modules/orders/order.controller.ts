import { FastifyRequest, FastifyReply } from "fastify";
import { broadcastOrderEvent } from "./order.stream";
import { prismaApp, prismaAdmin } from "../../core/config/databaseConfig";
import logger from "../../core/config/loggerConfig";
import crypto from "crypto";
import { sendWhatsAppMessage } from "../../core/utils/whatsapp";
import jwt from "jsonwebtoken";
import { JWT_ACCESS_SECRET } from "../../core/config/envConfig";
import { z } from "zod";
import { normalizePhone } from "../../core/utils/phone";

const customerPublicSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatarUrl: true,
  isActive: true,
  birthday: true,
  visits: true,
  reward_points: true,
  total_spend: true,
  favourite_item: true,
  saved_address: true,
  last_visit: true,
  createdAt: true,
};

// 7-day profile token for phone-verified customer sessions
const PROFILE_TOKEN_TTL = 7 * 24 * 60 * 60; // seconds

function signProfileToken(phone: string): string {
  return jwt.sign({ phone }, JWT_ACCESS_SECRET, { expiresIn: PROFILE_TOKEN_TTL });
}

function verifyProfileToken(token: string): { phone: string } {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET) as { phone: string };
  } catch {
    throw Object.assign(
      new Error("Profile session expired. Please verify your number again."),
      { statusCode: 401 },
    );
  }
}

// Helper for phone OTP hashing
async function hashCode(phone: string, code: string) {
  const data = new TextEncoder().encode(`${phone}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const placeOrderSchema = z.object({
  lines: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().positive(),
      weightGrams: z.number().optional().nullable(),
      weightLabel: z.string().optional().nullable(),
      instructions: z.array(z.string()).optional().nullable(),
    })
  ).min(1),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  paymentMethod: z.string(),
  isTakeaway: z.boolean().optional().nullable(),
  tableNumber: z.union([z.string(), z.number()]).optional().nullable(),
  couponCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const placeOrder = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const parsed = placeOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).send({ error: "Invalid order data", details: parsed.error.format() });
    }
    const data = parsed.data;

    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    if (!idempotencyKey) {
      return res.status(400).send({ error: "Idempotency-Key required" });
    }

    const normalizedPhone = normalizePhone(data.customerPhone);

    // 1. Fetch related data
    const productIds = [...new Set(data.lines.map((l: any) => l.productId))];
    const products = await prismaApp.product.findMany({
      where: { id: { in: productIds as string[] } },
    });
    const settings = await prismaAdmin.restaurantSettings.findFirst();
    const discounts = await prismaApp.discount.findMany({ where: { is_active: true } });
    const loyaltyRules = await prismaApp.loyaltyRule.findMany({
      where: { is_active: true },
    });

    if (!settings)
      return res.status(400).send({ error: "Restaurant is not configured yet" });

    // 2. Build items and subtotal
    const items = data.lines.map((line: any) => {
      const product = products.find((p) => p.id === line.productId);
      if (!product) throw new Error("An item in your cart is no longer available");
      if (!product.is_available)
        throw new Error(`${product.name} is currently unavailable`);

      const unitPrice = product.sold_by_weight
        ? Math.round(
            ((Number(product.price_per_kg) || 0) * (line.weightGrams || 250)) / 1000,
          )
        : Number(product.offer_price) > 0
          ? Number(product.offer_price)
          : Number(product.price);

      return {
        product_id: product.id,
        name: product.name,
        unit_price: unitPrice,
        quantity: line.quantity,
        weight_label: line.weightLabel,
        instructions: line.instructions?.length ? line.instructions.join(", ") : null,
        line_total: unitPrice * line.quantity,
      };
    });

    const subtotal = items.reduce((s: number, i: any) => s + i.line_total, 0);

    const sessionToken = req.cookies?.profile_token ?? req.headers["session-token"] ?? "no-session";
    const today = new Date().toISOString().slice(0, 10);
    const hour = new Date().getHours();

    const orderNumber = `SHV-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
    const billId = `BILL-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { newOrder: order, total } = await prismaApp.$transaction(async (tx) => {
      // 2b. Check Idempotency inside transaction
      const existingOrder = await tx.order.findFirst({
        where: {
          idempotency_key: idempotencyKey,
        },
      });
      if (existingOrder) return { newOrder: existingOrder, total: Number(existingOrder.total) };

      // 3. Customer lookup (inside transaction to prevent race conditions via FOR UPDATE)
      const customers = await tx.$queryRaw<any[]>`SELECT * FROM "users" WHERE "phone" = ${normalizedPhone} FOR UPDATE`;
      const existingCustomer = customers[0];

      let discount = 0;
      let discountLabel: string | null = null;

      // 4. Coupon/Campaign discounts
      const eligible = discounts.filter((d) => {
        if (d.starts_at && d.starts_at.toISOString().slice(0, 10) > today) return false;
        if (d.ends_at && d.ends_at.toISOString().slice(0, 10) < today) return false;
        if (subtotal < Number(d.min_order_amount)) return false;
        if (
          d.start_hour != null &&
          d.end_hour != null &&
          (hour < d.start_hour || hour >= d.end_hour)
        )
          return false;
        if (d.coupon_code)
          return data.couponCode?.toUpperCase() === d.coupon_code.toUpperCase();
        return true;
      });

      for (const d of eligible) {
        const raw =
          d.type === "flat" ? Number(d.value) : (subtotal * Number(d.value)) / 100;
        const capped = d.max_discount != null ? Math.min(raw, Number(d.max_discount)) : raw;
        if (capped > discount) {
          discount = capped;
          discountLabel = d.name;
        }
      }

      // 5. Loyalty discounts (only on the milestone order, e.g. exactly 25th, 50th visit)
      const visits = existingCustomer?.visits ?? 0;
      const loyaltyTier = loyaltyRules
        .filter((r) => visits + 1 === r.visits_required)
        .sort((a, b) => b.visits_required - a.visits_required)[0];

      if (loyaltyTier) {
        const loyaltyValue = (subtotal * Number(loyaltyTier.discount_percent)) / 100;
        if (loyaltyValue > discount) {
          discount = loyaltyValue;
          discountLabel = `Loyalty reward (${loyaltyTier.discount_percent}% • ${visits} visits)`;
        }
      }

      // Combined discount must never exceed subtotal (prevents negative totals)
      // Also cap percentage-based discounts so they can't logically exceed 100%
      discount = Math.max(0, Math.round(Math.min(discount, subtotal) * 100) / 100);
      const taxable = Math.max(0, subtotal - discount);
      const tax = Math.max(
        0,
        Math.round(((taxable * Number(settings.tax_percent)) / 100) * 100) / 100,
      );
      const packing = data.isTakeaway ? Math.max(0, Number(settings.packing_charge)) : 0;
      const delivery = data.isTakeaway ? Math.max(0, Number(settings.delivery_charge)) : 0;
      const total = Math.max(
        0,
        Math.round((taxable + tax + packing + delivery) * 100) / 100,
      );

      const earnedPoints = Math.floor(total / 100) * 10;

      // Upsert customer
      let customer;
      if (existingCustomer) {
        customer = await tx.user.update({
          where: { id: existingCustomer.id },
          data: {
            visits: { increment: 1 },
            reward_points: { increment: earnedPoints },
            total_spend: { increment: total },
            last_visit: new Date(),
            favourite_item: items[0]?.name ?? existingCustomer.favourite_item,
          },
        });
      } else {
        customer = await tx.user.create({
          data: {
            name: data.customerName,
            email: `${normalizedPhone}@guest.maatarasweets.com`,
            password: crypto.randomBytes(16).toString("hex"),
            role: "USER",
            phone: normalizedPhone,
            visits: 1,
            reward_points: earnedPoints,
            total_spend: total,
            last_visit: new Date(),
            favourite_item: items[0]?.name ?? null,
          },
        });
        await tx.appNotification.create({
          data: {
            type: "customer",
            title: "New customer registered",
            body: `${data.customerName} (${normalizedPhone}) placed their first order.`,
          },
        });
      }

      // Create Order
      const newOrder = await tx.order.create({
        data: {
          order_number: orderNumber,
          bill_id: billId,
          table_number: data.tableNumber ? Number(data.tableNumber) : null,
          user_id: customer.id,
          customer_name: data.customerName,
          customer_phone: normalizedPhone,
          payment_method: data.paymentMethod,
          status: "PENDING",
          payment_status: "pending",
          idempotency_key: idempotencyKey,
          session_token: crypto.randomUUID
            ? crypto.randomUUID()
            : crypto.randomBytes(16).toString("hex"),
          subtotal,
          discount,
          discount_label: discountLabel,
          tax,
          packing_charge: packing,
          delivery_charge: delivery,
          total,
          notes: data.notes,
          order_items: {
            create: items.map((i: any) => ({
              product_id: i.product_id,
              name: i.name,
              unit_price: i.unit_price,
              quantity: i.quantity,
              weight_label: i.weight_label,
              instructions: i.instructions,
              line_total: i.line_total,
            })),
          },
        },
      });

      if (discountLabel) {
        await tx.appNotification.create({
          data: {
            type: "offer",
            title: "Offer used",
            body: `${discountLabel} applied on ${orderNumber}.`,
          },
        });
      }

      const serveAt = data.tableNumber
        ? `Serve at table ${data.tableNumber}`
        : "Takeaway / parcel";
      await tx.appNotification.create({
        data: {
          type: "order",
          title: `New order ${orderNumber}`,
          body: `${serveAt} • ${data.customerName} • ₹${total}`,
        },
      });

      broadcastOrderEvent("order_created", newOrder);
      return { newOrder, total };
    });

    const serveAt = data.tableNumber
      ? `Serve at table ${data.tableNumber}`
      : "Takeaway / parcel";
    void sendWhatsAppMessage(
      data.customerPhone,
      `🍽 *Shivansi Restaurant & Sweet Shop*\n\nHi ${data.customerName}, your order *${order.order_number}* is confirmed.\n${serveAt}\nItems: ${items
        .map((i: any) => `${i.quantity}× ${i.name}`)
        .join(
          ", ",
        )}\nTotal: ₹${total}\n\nThis is an automated message from our ordering bot — replies are not monitored.`,
    );

    // Notify Admin
    if (settings.phone) {
      void sendWhatsAppMessage(
        settings.phone,
        `*New Order Alert: ${order.order_number}*\n\nCustomer: ${data.customerName}\n${serveAt}\nTotal: ₹${total}\n\nPlease check the admin dashboard to approve this order.`,
      );
    }

    return res.send({
      id: order.id,
      token: order.session_token,
      orderNumber: order.order_number,
      billId: order.bill_id,
    });
  } catch (error: any) {
    logger.error(`Error in placeOrder: ${error.message}`);
    return res.status(400).send({ error: error.message });
  }
};

export const updateOrderStatus = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { id } = req.params as any;
    const { status } = req.body as any;

    const VALID_STATUSES = [
      "PENDING",
      "CONFIRMED",
      "PREPARING",
      "PREPARED",
      "SERVED",
      "COMPLETED",
      "CANCELLED",
    ];
    if (!VALID_STATUSES.includes(status)) {
      return res
        .status(400)
        .send({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
    }

    // Fetch current order to validate the transition is forward (or cancellation)
    const current = await prismaApp.order.findUnique({
      where: { id },
      select: {
        status: true,
        customer_phone: true,
        customer_name: true,
        order_number: true,
        table_number: true,
      },
    });
    if (!current) return res.status(404).send({ error: "Order not found" });

    const STATUS_ORDER = [
      "PENDING",
      "CONFIRMED",
      "PREPARING",
      "PREPARED",
      "SERVED",
      "COMPLETED",
    ];
    const currentIdx = STATUS_ORDER.indexOf(current.status);
    const nextIdx = STATUS_ORDER.indexOf(status);
    // Allow only forward transitions (or explicit CANCELLED from any non-completed state)
    if (
      status !== "CANCELLED" &&
      nextIdx !== -1 &&
      currentIdx !== -1 &&
      nextIdx < currentIdx
    ) {
      return res
        .status(400)
        .send({ error: `Cannot move order back from ${current.status} to ${status}` });
    }
    if (current.status === "COMPLETED" || current.status === "CANCELLED") {
      return res
        .status(400)
        .send({ error: `Order is already ${current.status} and cannot be changed` });
    }

    let order;
    try {
      order = await prismaApp.order.update({
        where: { id, status: current.status },
        data: { status },
      });
    } catch (err: any) {
      if (err.code === "P2025") {
        return res.status(409).send({ error: "Order status was updated by another request. Please refresh." });
      }
      throw err;
    }

    const STATUS_MESSAGE: Record<string, string> = {
      CONFIRMED: "has been accepted by the kitchen",
      PREPARING: "is being prepared right now",
      PREPARED: "is ready to be served",
      SERVED: "has been served — enjoy your meal!",
      COMPLETED: "is complete. Thank you for dining with us",
      CANCELLED: "could not be accepted. Please talk to our staff.",
    };

    const line = STATUS_MESSAGE[status];
    if (line && current.customer_phone) {
      void sendWhatsAppMessage(
        current.customer_phone,
        `🍽 *Maa Tara Sweets*\n\nHi ${current.customer_name}, your order *${current.order_number}* ${line}\n${current.table_number ? `Table ${current.table_number}` : "Takeaway"}\n\nAutomated bot update — replies are not monitored.`,
      );
    }

    broadcastOrderEvent("order_updated", order);
    return res.send({ ok: true, order });
  } catch (error: any) {
    logger.error(`Error in updateOrderStatus: ${error.message}`);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};

export const updatePaymentStatus = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { id } = req.params as any;
    const order = await prismaApp.order.update({
      where: { id },
      data: { payment_status: "paid" },
    });
    broadcastOrderEvent("order_updated", order);
    return res.send({ ok: true, order });
  } catch (error: any) {
    logger.error(`Error in updatePaymentStatus: ${error.message}`);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};

export const getPublicOrder = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { id, token } = req.query as any;
    
    const order = await prismaApp.order.findFirst({
      where: { id, session_token: token },
      include: { order_items: true },
    });
    if (!order) return res.send(null);
    const settings = await prismaAdmin.restaurantSettings.findFirst();
    return res.send({ order, settings });
  } catch (error: any) {
    logger.error(`Error in getPublicOrder: ${error.message}`);
    return res.status(400).send({ error: error.message });
  }
};

const requestOrderHistoryCodeSchema = z.object({
  phone: z.string().min(10),
});

export const requestOrderHistoryCode = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const parsed = requestOrderHistoryCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).send({ error: "Invalid request data", details: parsed.error.format() });
    }
    const { phone } = parsed.data;
    const normalizedPhone = normalizePhone(phone);

    // Rate limit: prevent requesting a new code if one was requested in the last 1 minute
    const recent = await prismaApp.phoneVerification.findFirst({
      where: {
        phone: normalizedPhone,
        created_at: { gt: new Date(Date.now() - 60 * 1000) },
      },
    });

    if (recent) {
      return res.status(429).send({ error: "Please wait before requesting a new code" });
    }

    const code = String(
      crypto.getRandomValues(new Uint32Array(1))[0]! % 1000000,
    ).padStart(6, "0");
    const hash = await hashCode(normalizedPhone, code);

    await prismaApp.phoneVerification.create({
      data: {
        phone: normalizedPhone,
        code_hash: hash,
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    void sendWhatsAppMessage(
      normalizedPhone,
      `🔐 *Shivansi Restaurant & Sweet Shop*\n\nYour order history verification code is *${code}*. It expires in 10 minutes.\n\nAutomated message — never share this code with anyone.`,
    );

    return res.send({ ok: true, delivered: true });
  } catch (error: any) {
    logger.error(`Error in requestOrderHistoryCode: ${error.message}`);
    return res.status(400).send({ error: error.message });
  }
};

const getOrdersByPhoneSchema = z.object({
  phone: z.string().min(10),
  code: z.string().min(6),
});

export const getOrdersByPhone = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const parsed = getOrdersByPhoneSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).send({ error: "Invalid request data", details: parsed.error.format() });
    }
    const { phone, code } = parsed.data;
    const normalizedPhone = normalizePhone(phone);

    const challenge = await prismaApp.phoneVerification.findFirst({
      where: {
        phone: normalizedPhone,
        used: false,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: "desc" },
    });

    const invalid = new Error("That code is invalid or has expired. Request a new one.");
    if (!challenge || challenge.attempts >= 5) throw invalid;

    const hash = await hashCode(normalizedPhone, code);
    if (challenge.code_hash !== hash) {
      await prismaApp.phoneVerification.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw invalid;
    }

    await prismaApp.phoneVerification.update({
      where: { id: challenge.id },
      data: { used: true },
    });

    let customer = await prismaApp.user.findUnique({
      where: { phone: normalizedPhone },
      select: customerPublicSelect,
    });

    if (!customer) {
      customer = await prismaApp.user.create({
        data: {
          name: normalizedPhone, // Provide a default name since it's required
          email: `${normalizedPhone}@guest.maatarasweets.com`,
          password: crypto.randomBytes(16).toString("hex"),
          role: "USER",
          phone: normalizedPhone,
          visits: 0,
          reward_points: 0,
          total_spend: 0,
        },
        select: customerPublicSelect,
      }) as any;
    }

    const orders = await prismaApp.order.findMany({
      where: { user_id: customer!.id },
      include: { order_items: true },
      orderBy: { created_at: "desc" },
      take: 50,
    });

    // Issue a signed profile token so the customer can access /customer-profile
    // without a full user account / JWT session.
    const profileToken = signProfileToken(normalizedPhone);

    res.setCookie("profileToken", profileToken, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return res.send({ customer, orders });
  } catch (error: any) {
    logger.error(`Error in getOrdersByPhone: ${error.message}`);
    return res.status(400).send({ error: error.message });
  }
};

// ─── GET /data/customer-profile ─────────────────────────────────────────────
// Query params: phone
// Cookies: profileToken
export const getCustomerProfile = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { phone } = req.query as { phone?: string };
    const token = req.cookies.profileToken;
    
    if (!phone)
      return res.status(400).send({ error: "phone is required" });

    const normalizedPhone = normalizePhone(phone);
    
    let isAuthorized = false;
    
    // Try JWT first
    try {
      await (req as any).jwtVerify();
      const jwtUser = req.user as any;
      if (jwtUser) {
        if (jwtUser.role === "ADMIN" || jwtUser.role === "SUPERADMIN") {
          isAuthorized = true;
        } else if (jwtUser.phone === normalizedPhone) {
          isAuthorized = true;
        }
      }
    } catch (e) {
      // ignore, fallback to profileToken
    }

    if (!isAuthorized) {
      if (!token)
        return res.status(401).send({ error: "Profile token missing. Please verify phone again." });

      const payload = verifyProfileToken(token);
      if (payload.phone !== normalizedPhone)
        return res.status(401).send({ error: "Token does not match phone" });
    }

    const customer = await prismaApp.user.findUnique({
      where: { phone: normalizedPhone },
      select: customerPublicSelect,
    });
    if (!customer)
      return res.status(404).send({ error: "No profile found for this number" });

    const orders = await prismaApp.order.findMany({
      where: { user_id: customer.id },
      include: { order_items: true },
      orderBy: { created_at: "desc" },
      take: 50,
    });

    return res.send({ customer, orders });
  } catch (error: any) {
    logger.error(`Error in getCustomerProfile: ${error.message}`);
    return res.status(error.statusCode ?? 400).send({ error: error.message });
  }
};

// ─── PATCH /data/customer-profile ───────────────────────────────────────────
// Body: { phone, name?, birthday?, saved_address? }
export const updateCustomerProfile = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { phone, name, birthday, saved_address } = req.body as any;
    const token = req.cookies.profileToken;
    
    if (!phone)
      return res.status(400).send({ error: "phone is required" });
    if (!token)
      return res.status(401).send({ error: "Profile token missing. Please verify phone again." });

    const payload = verifyProfileToken(token);
    if (payload.phone !== phone)
      return res.status(401).send({ error: "Token does not match phone" });

    const customer = await prismaApp.user.findUnique({
      where: { phone },
      select: customerPublicSelect,
    });
    if (!customer)
      return res.status(404).send({ error: "No profile found for this number" });

    const updated = await prismaApp.user.update({
      where: { phone },
      data: {
        ...(name !== undefined && { name: String(name).trim().slice(0, 80) }),
        ...(birthday !== undefined && { birthday: birthday ? new Date(birthday) : null }),
        ...(saved_address !== undefined && {
          saved_address: String(saved_address).trim().slice(0, 200) || null,
        }),
      },
      select: customerPublicSelect,
    });

    return res.send({ customer: updated });
  } catch (error: any) {
    logger.error(`Error in updateCustomerProfile: ${error.message}`);
    return res.status(error.statusCode ?? 400).send({ error: error.message });
  }
};

export const submitRating = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { orderId, menuItemId, phone, stars, comment } = req.body as any;
    if (!orderId || !menuItemId || !phone || !stars) {
      return res
        .status(400)
        .send({ error: "orderId, menuItemId, phone, and stars are required" });
    }

    const normalizedPhone = normalizePhone(phone);

    // Verify order belongs to phone and contains the product
    const order = await prismaApp.order.findFirst({
      where: {
        id: orderId,
        customer_phone: normalizedPhone,
        order_items: { some: { product_id: menuItemId } },
      },
    });

    if (!order)
      return res.status(404).send({ error: "Order or item not found for this user" });

    let rating;
    try {
      rating = await prismaApp.rating.create({
        data: {
          orderId,
          menuItemId,
          phone: normalizedPhone,
          stars: Number(stars),
          comment: comment || null,
        },
      });
    } catch (err: any) {
      if (err.code === "P2002") {
        return res.status(400).send({ error: "You already rated this item for this order" });
      }
      throw err;
    }

    // Update product rating aggregate using database-level aggregation (Weekly)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const agg = await prismaApp.rating.aggregate({
      where: { 
        menuItemId,
        createdAt: { gte: oneWeekAgo }
      },
      _avg: { stars: true },
      _count: { _all: true },
    });

    await prismaApp.product.update({
      where: { id: menuItemId },
      data: {
        rating: agg._avg.stars ?? 0,
        review_count: agg._count._all,
      },
    });

    return res.send({ ok: true, rating });
  } catch (error: any) {
    logger.error(`Error in submitRating: ${error.message}`);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};
