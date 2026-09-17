import { queryOptions } from "@tanstack/react-query";
import axios from "axios";
import type {
  AppNotification,
  Category,
  Customer,
  Discount,
  InventoryItem,
  LoyaltyRule,
  Offer,
  Order,
  Product,
  RestaurantSettings,
  RestaurantTable,
  Review,
  StaffUser,
} from "./types";

import { getPublicSocket, connectAdminSocket } from "./socket";

export const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"] || "/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // If it's a 401, we haven't already retried, and it's not the login or refresh endpoints itself
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh-token") &&
      !originalRequest.url?.includes("/auth/login")
    ) {
      originalRequest._retry = true;
      try {
        await axios.post(
          `${API_BASE_URL}/auth/refresh-token`,
          {},
          { withCredentials: true },
        );
        return apiClient(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);

export interface ApiRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export async function fetchAPI<T>(
  endpoint: string,
  options?: ApiRequestOptions,
): Promise<T> {
  const isPost = options?.method && options.method !== "GET";
  const url =
    endpoint.startsWith("/auth") || endpoint.startsWith("/data")
      ? endpoint
      : `/data${endpoint}`;

  try {
    const response = await apiClient({
      url,
      method: options?.method || "GET",
      headers: options?.headers,
      data: isPost && options?.body ? JSON.parse(options.body) : undefined,
      signal: options?.signal,
    });
    return response.data;
  } catch (error: any) {
    // Safely extract a string message regardless of backend response shape:
    // { error: "msg" } | { message: "msg" } | { error: { message: "msg" } }
    const raw = error.response?.data?.error ?? error.response?.data?.message ?? null;
    const msg: string | null =
      raw == null
        ? null
        : typeof raw === "string"
          ? raw
          : typeof raw?.message === "string"
            ? raw.message
            : null;
    if (msg) throw new Error(msg);
    if (error.code === "ERR_NETWORK") {
      throw new Error(
        "Unable to connect to the server. Please check your internet connection.",
      );
    }
    throw new Error(error?.message ?? "Something went wrong. Please try again later.");
  }
}

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async ({ signal }) => {
    const settings = await fetchAPI<RestaurantSettings | null>(`/settings?_t=${Date.now()}`, { signal });
    return settings;
  },
  staleTime: 30_000,
});

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: ({ signal }) => fetchAPI<Category[]>("/categories", { signal }),
  staleTime: 60_000,
});

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: ({ signal }) => fetchAPI<Product[]>("/products", { signal }),
  staleTime: 60_000,
});

export const offersQuery = queryOptions({
  queryKey: ["offers"],
  queryFn: ({ signal }) => fetchAPI<Offer[]>("/offers", { signal }),
  staleTime: 60_000,
});

export const discountsQuery = queryOptions({
  queryKey: ["discounts"],
  queryFn: ({ signal }) => fetchAPI<Discount[]>("/discounts", { signal }),
  staleTime: 60_000,
});

export const loyaltyQuery = queryOptions({
  queryKey: ["loyalty"],
  queryFn: ({ signal }) => fetchAPI<LoyaltyRule[]>("/loyalty", { signal }),
  staleTime: 60_000,
});

export const tablesQuery = queryOptions({
  queryKey: ["tables"],
  queryFn: ({ signal }) => fetchAPI<RestaurantTable[]>("/tables", { signal }),
  staleTime: 60_000,
});

export const reviewsQuery = queryOptions({
  queryKey: ["reviews", "published"],
  queryFn: ({ signal }) => fetchAPI<Review[]>("/reviews?limit=6", { signal }),
  staleTime: 30_000,
});

export const googleRatingsQuery = queryOptions({
  queryKey: ["googleRatings"],
  queryFn: async ({ signal }) => {
    try {
      return await fetchAPI<any>("/reviews/google", { signal });
    } catch (e) {
      return null;
    }
  },
  staleTime: 3600_000,
});

export const allReviewsQuery = queryOptions({
  queryKey: ["reviews", "all"],
  queryFn: ({ signal }) => fetchAPI<Review[]>("/reviews/admin?limit=50", { signal }),
  staleTime: 15_000,
});

export const inventoryQuery = queryOptions({
  queryKey: ["inventory"],
  queryFn: ({ signal }) => fetchAPI<InventoryItem[]>("/inventory", { signal }),
});

export const customersQuery = queryOptions({
  queryKey: ["customers"],
  queryFn: ({ signal }) => fetchAPI<Customer[]>("/customers", { signal }),
});

export const ordersQuery = queryOptions({
  queryKey: ["orders"],
  queryFn: ({ signal }) => fetchAPI<Order[]>("/orders", { signal }),
});

export const notificationsQuery = queryOptions({
  queryKey: ["notifications"],
  queryFn: ({ signal }) => fetchAPI<AppNotification[]>("/notifications", { signal }),
});

export function activeOffers(offers: Offer[]) {
  const today = new Date().toISOString().slice(0, 10);
  return offers.filter(
    (o) =>
      o.is_active &&
      (!o.starts_at || o.starts_at <= today) &&
      (!o.ends_at || o.ends_at >= today),
  );
}

export const staffQuery = queryOptions({
  queryKey: ["staff"],
  queryFn: async ({ signal }) => {
    // getAllUsers uses reply.send({success, users}) — no sendSuccess wrapper
    // so response.data is {success: true, users: []}. Access .users directly.
    const data = await fetchAPI<any>("/users", { signal });
    // Defensively handle both flat {users:[]} and wrapped {data:{users:[]}} shapes.
    return (data?.users ?? data?.data?.users ?? []) as StaffUser[];
  },
});
