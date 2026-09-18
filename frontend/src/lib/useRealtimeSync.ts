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
  const processedOrders = useRef<Set<string>>(new Set());

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
      const { order } = payload;
      
      if (!processedOrders.current.has(order.id)) {
        processedOrders.current.add(order.id);
        
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
              // Scroll to top where the live orders are
              window.scrollTo({ top: 0, behavior: "smooth" });
            },
          },
        });
      }

      // Invalidate queries to trigger re-fetch and UI update
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin_stats"] });
    };

    const onOrderUpdated = (payload: { order: Order }) => {
      // Refresh the orders list
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      // Invalidate specific public-order query if open (for testing mainly)
      void queryClient.invalidateQueries({ queryKey: ["public-order", payload.order.id] });
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

  // Public socket for general menu/settings updates (if we want global updates)
  useEffect(() => {
    const socket = getPublicSocket();
    
    const onMenuUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: ["menu"] });
      void queryClient.invalidateQueries({ queryKey: ["offers"] });
    };
    
    const onSettingsUpdated = (payload: { settings: any }) => {
      if (payload?.settings) {
        queryClient.setQueryData(["settings"], payload.settings);
      }
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    };

    socket.on("menu:product_updated", onMenuUpdated);
    socket.on("menu:availability_changed", onMenuUpdated);
    socket.on("settings:updated", onSettingsUpdated);

    // Subscribe to menu updates room
    socket.emit("subscribe:menu");

    return () => {
      socket.off("menu:product_updated", onMenuUpdated);
      socket.off("menu:availability_changed", onMenuUpdated);
      socket.off("settings:updated", onSettingsUpdated);
    };
  }, [queryClient]);
}
