import { z } from "zod";

export const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  price: z.number().min(0).refine((val) => Number.isFinite(val), { message: "Price must be a finite number" }),
  offer_price: z.number().min(0).optional().nullable(),
  category_id: z.string().optional().nullable(),
  is_available: z.boolean().default(true),
  is_veg: z.boolean().default(true),
  is_spicy: z.boolean().default(false),
  is_special: z.boolean().default(false),
  is_popular: z.boolean().default(false),
  is_recommended: z.boolean().default(false),
  sold_by_weight: z.boolean().default(false),
  price_per_kg: z.number().min(0).optional().nullable(),
  calories: z.number().min(0).optional(),
  prep_time_mins: z.number().min(0).optional(),
  sort_order: z.number().optional(),
  image_url: z.string().optional().nullable(),
  weight_label: z.string().optional().nullable(),
}).strict();

export const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  sort_order: z.number().default(0),
}).strict();

export const offerSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  banner_url: z.string().optional().nullable(),
  discount_percent: z.number().min(0).max(100).refine((val) => Number.isFinite(val)),
  coupon_code: z.string().optional().nullable(),
  starts_at: z.string().or(z.date()).optional().nullable(),
  ends_at: z.string().or(z.date()).optional().nullable(),
  is_active: z.boolean().default(true),
  category_ids: z.array(z.string()).default([]),
  product_ids: z.array(z.string()).default([]),
}).strict();

export const discountSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  type: z.enum(["percent", "flat", "fixed"]),
  coupon_code: z.string().optional().nullable(),
  value: z.number().min(0).refine((val) => Number.isFinite(val)),
  min_order_amount: z.number().min(0).refine((val) => Number.isFinite(val)),
  max_discount: z.number().min(0).optional().nullable(),
  is_active: z.boolean().default(true),
  category_ids: z.array(z.string()).default([]),
  product_ids: z.array(z.string()).default([]),
  starts_at: z.string().or(z.date()).optional().nullable(),
  ends_at: z.string().or(z.date()).optional().nullable(),
  start_hour: z.number().min(0).max(23).optional().nullable(),
  end_hour: z.number().min(0).max(23).optional().nullable(),
  usage_count: z.number().min(0).optional(),
}).strict();

export const loyaltyRuleSchema = z.object({
  id: z.string().optional(),
  visits_required: z.number().min(1).refine((val) => Number.isFinite(val)),
  discount_percent: z.number().min(0).max(100).refine((val) => Number.isFinite(val)),
  reward_points: z.number().min(0).refine((val) => Number.isFinite(val)),
  expiry_days: z.number().min(1).refine((val) => Number.isFinite(val)),
  is_active: z.boolean().default(true),
}).strict();

export const inventoryItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.number().min(0),
  low_stock_threshold: z.number().min(0),
  cost_per_unit: z.number().min(0),
  expiry_date: z.string().or(z.date()).optional().nullable(),
}).strict();

export const restaurantTableSchema = z.object({
  id: z.string().or(z.number()).optional(),
  table_number: z.number().min(1),
  capacity: z.number().min(1).optional(),
  seats: z.number().min(1).optional(),
  status: z.string().optional(),
  is_active: z.boolean().default(true),
}).strict();

export const restaurantSettingsSchema = z.object({
  id: z.string().optional(),
  restaurant_name: z.string().min(1).optional(),
  is_accepting_orders: z.boolean().optional(),
  is_suspended: z.boolean().optional(),
  tax_percent: z.number().min(0).max(100).optional(),
  upi_id: z.string().optional().nullable(),
}).passthrough(); // Keep passthrough for settings as they might be dynamic

export const appConfigSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(1),
  value: z.any(),
});

export const crudSchemas: Record<string, z.ZodTypeAny> = {
  products: productSchema,
  categories: categorySchema,
  offers: offerSchema,
  discounts: discountSchema,
  loyalty_rules: loyaltyRuleSchema,
  inventory_items: inventoryItemSchema,
  restaurant_tables: restaurantTableSchema,
  restaurant_settings: restaurantSettingsSchema,
  app_config: appConfigSchema,
};
