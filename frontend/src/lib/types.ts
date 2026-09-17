export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  image_url: string | null;
  price: number;
  offer_price: number | null;
  rating: number;
  review_count: number;
  prep_time_mins: number;
  is_available: boolean;
  is_spicy: boolean;
  calories: number;
  is_special: boolean;
  is_popular: boolean;
  is_recommended: boolean;
  sold_by_weight: boolean;
  price_per_kg: number | null;
  sort_order: number;
}

export interface RestaurantSettings {
  id: string;
  name: string;
  tagline: string;
  logo_url: string | null;
  banner_url: string | null;
  address: string;
  phone: string;
  gst_number: string;
  opening_time: string;
  closing_time: string;
  upi_id: string;
  tax_percent: number;
  packing_charge: number;
  delivery_charge: number;
  currency: string;
  theme: string;
  is_suspended: boolean;
  shutdown_code: number | null;
  shutdown_message: string | null;
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  banner_url: string | null;
  discount_percent: number;
  coupon_code: string | null;
  category_ids: string[];
  product_ids: string[];
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
}

export interface Discount {
  id: string;
  name: string;
  type: string;
  coupon_code: string | null;
  value: number;
  min_order_amount: number;
  max_discount: number | null;
  category_ids: string[];
  product_ids: string[];
  starts_at: string | null;
  ends_at: string | null;
  start_hour: number | null;
  end_hour: number | null;
  is_active: boolean;
  usage_count: number;
}

export interface LoyaltyRule {
  id: string;
  visits_required: number;
  discount_percent: number;
  reward_points: number;
  expiry_days: number;
  is_active: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  low_stock_threshold: number;
  cost_per_unit: number;
  expiry_date: string | null;
}

export interface RestaurantTable {
  id: string;
  table_number: number;
  seats: number;
  is_active: boolean;
}

export interface Customer {
  id: string;
  user_id: string | null;
  name: string;
  phone: string;
  birthday: string | null;
  visits: number;
  reward_points: number;
  total_spend: number;
  favourite_item: string | null;
  saved_address: string | null;
  last_visit: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
  weight_label: string | null;
  instructions: string | null;
  line_total: number;
}

export interface Order {
  id: string;
  order_number: string;
  session_token: string;
  table_number: number | null;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  status: OrderStatus;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  discount: number;
  discount_label: string | null;
  tax: number;
  packing_charge: number;
  delivery_charge: number;
  total: number;
  notes: string | null;
  created_at: string;
  order_items?: OrderItem[];
}

export interface Review {
  id: string;
  product_id: string | null;
  customer_name: string;
  rating: number;
  comment: string;
  is_published: boolean;
  created_at: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "PREPARED"
  | "SERVED"
  | "COMPLETED"
  | "CANCELLED";

export const ORDER_FLOW: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "PREPARED",
  "SERVED",
  "COMPLETED",
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Waiting for confirmation",
  CONFIRMED: "Order accepted",
  CANCELLED: "Order rejected",
  PREPARING: "Preparing your food",
  PREPARED: "Ready to serve",
  SERVED: "Served at your table",
  COMPLETED: "Completed",
};

export const WEIGHT_OPTIONS = [
  { label: "250 g", grams: 250 },
  { label: "500 g", grams: 500 },
  { label: "750 g", grams: 750 },
  { label: "1 kg", grams: 1000 },
  { label: "2 kg", grams: 2000 },
];

export const COOKING_INSTRUCTIONS = [
  "No Onion",
  "Extra Butter",
  "Extra Spicy",
  "Less Oil",
  "Extra Cheese",
];

export const PAYMENT_METHODS = ["Cash", "UPI", "Google Pay", "PhonePe", "Paytm", "Card"];

export interface StaffUser {
  id: string;
  name: string | null;
  email: string;
  role: "USER" | "ADMIN" | "SUPERADMIN";
  createdAt: string;
  isActive: boolean;
}
