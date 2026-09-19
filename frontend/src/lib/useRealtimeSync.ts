import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useIsAdmin } from "./auth";
import { connectAdminSocket, disconnectAdminSocket, getPublicSocket } from "./socket";
import type { Order } from "./types";

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const { isAdmin, mfaSatisfied, user } = useIsAdmin();
  
  // Track previous order IDs to prevent duplicate toasts for the same order across reconnections
  // Bounded TTL map to prevent unbounded memory growth
  const processedOrders = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Only connect admin socket if the user is a fully authenticated admin
    if (!isAdmin || !mfaSatisfied || !user) {
      disconnectAdminSocket();
      return;
    }

    const socket = connectAdminSocket();

    // ─── Connection handling ───
    const onConnect = () => {
      console.log("[RealtimeSync] Connected to admin namespace");
      // Invalidate queries to ensure we have fresh data after connection/reconnection
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["admin_stats"] });
    };

    // ─── Order Events ───
    const onOrderCreated = (payload: { order: Order; timestamp: number }) => {
      const { order, timestamp } = payload;
      
      const now = Date.now();
      // Cleanup old entries
      for (const [id, time] of processedOrders.current.entries()) {
        if (now - time > 30 * 60 * 1000) processedOrders.current.delete(id); // 30 min TTL
      }
      
      if (!processedOrders.current.has(order.id)) {
        processedOrders.current.set(order.id, now);
        
        // Play notification sound
        try {
          const audio = new Audio("/notification.mp3");
          audio.volume = 0.5;
          audio.play().catch(() => {}); // ignore autoplay restrictions
        } catch (e) {}

        // Show toast
        toast("New order received!", {
          description: `${order.customer_name} placed order ${order.order_number}`,
          action: {
            label: "View",
            onClick: () => {
              window.scrollTo({ top: 0, behavior: "smooth" });
            },
          },
        });
      }

      // Optimistic cache update instead of full refetch
      queryClient.setQueryData<Order[]>(["orders"], (old = []) => {
        if (!old.find(o => o.id === order.id)) {
          return [order, ...old];
        }
        return old;
      });
      void queryClient.invalidateQueries({ queryKey: ["admin_stats"] });
    };

    const onOrderUpdated = (payload: { order: Order }) => {
      // Optimistic cache update instead of full refetch
      queryClient.setQueryData<Order[]>(["orders"], (old) => {
        if (!old) return old;
        return old.map(o => (o.id === payload.order.id ? { ...o, ...payload.order } : o));
      });
      // We don't invalidate public-order here since public UI subscribes itself
    };

    const onNotificationNew = (payload: { notification: any }) => {
      toast("Notification", { description: payload.notification.title });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };

    const onMenuProductUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: ["menu"] });
    };

    const onSettingsUpdated = (payload: { settings: any }) => {
      if (payload?.settings) {
        queryClient.setQueryData(["settings"], payload.settings);
      }
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    };

    // Bind events
    socket.on("connect", onConnect);
    socket.on("order:created", onOrderCreated);
    socket.on("order:updated", onOrderUpdated);
    socket.on("order:status_changed", onOrderUpdated);
    socket.on("order:payment_updated", onOrderUpdated);
    socket.on("notification:new", onNotificationNew);
    socket.on("menu:product_updated", onMenuProductUpdated);
    socket.on("menu:availability_changed", onMenuProductUpdated);
    socket.on("settings:updated", onSettingsUpdated);

    // Initial fetch if already connected
    if (socket.connected) {
      onConnect();
    }

    return () => {
      // Unbind events on cleanup
      socket.off("connect", onConnect);
      socket.off("order:created", onOrderCreated);
      socket.off("order:updated", onOrderUpdated);
      socket.off("order:status_changed", onOrderUpdated);
      socket.off("order:payment_updated", onOrderUpdated);
      socket.off("notification:new", onNotificationNew);
      socket.off("menu:product_updated", onMenuProductUpdated);
      socket.off("menu:availability_changed", onMenuProductUpdated);
      socket.off("settings:updated", onSettingsUpdated);
    };
  }, [isAdmin, mfaSatisfied, user, queryClient]);
}
