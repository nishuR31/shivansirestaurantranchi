/**
 * Socket.IO Event Emitter — modular broadcast functions for real-time events.
 * Wraps getIO() from socketConfig.ts with typed, room-targeted emissions.
 */
import {
  getAdminNamespace,
  getPublicNamespace,
  EVENTS,
  ROOMS,
} from "../config/socketConfig";
import logger from "../config/loggerConfig";

// ─── Order Events ────────────────────────────────────────────────────────────

export function emitOrderCreated(order: any) {
  try {
    const adminNs = getAdminNamespace();
    adminNs.to(ROOMS.ORDERS).emit(EVENTS.ORDER_CREATED, {
      order,
      timestamp: Date.now(),
    });
    logger.info(`[Socket.IO] Emitted order:created → ${order.order_number}`);
  } catch (err: any) {
    logger.error(`[Socket.IO] emitOrderCreated failed: ${err.message}`);
  }
}

export function emitOrderUpdated(order: any) {
  try {
    const adminNs = getAdminNamespace();
    const publicNs = getPublicNamespace();

    // Notify admin dashboard
    adminNs.to(ROOMS.ORDERS).emit(EVENTS.ORDER_UPDATED, {
      order,
      timestamp: Date.now(),
    });

    // Notify customer tracking the specific order
    publicNs.to(ROOMS.order(order.id)).emit(EVENTS.ORDER_UPDATED, {
      order,
      timestamp: Date.now(),
    });

    logger.info(
      `[Socket.IO] Emitted order:updated → ${order.order_number || order.id}`,
    );
  } catch (err: any) {
    logger.error(`[Socket.IO] emitOrderUpdated failed: ${err.message}`);
  }
}

export function emitOrderStatusChanged(order: any, previousStatus: string) {
  try {
    const adminNs = getAdminNamespace();
    const publicNs = getPublicNamespace();

    const payload = {
      order,
      previousStatus,
      newStatus: order.status,
      timestamp: Date.now(),
    };

    adminNs.to(ROOMS.ORDERS).emit(EVENTS.ORDER_STATUS_CHANGED, payload);
    publicNs.to(ROOMS.order(order.id)).emit(EVENTS.ORDER_STATUS_CHANGED, payload);

    logger.info(
      `[Socket.IO] Emitted order:status_changed → ${order.order_number || order.id}: ${previousStatus} → ${order.status}`,
    );
  } catch (err: any) {
    logger.error(`[Socket.IO] emitOrderStatusChanged failed: ${err.message}`);
  }
}

export function emitOrderPaymentUpdated(order: any) {
  try {
    const adminNs = getAdminNamespace();
    const publicNs = getPublicNamespace();

    const payload = { order, timestamp: Date.now() };

    adminNs.to(ROOMS.ORDERS).emit(EVENTS.ORDER_PAYMENT_UPDATED, payload);
    publicNs.to(ROOMS.order(order.id)).emit(EVENTS.ORDER_PAYMENT_UPDATED, payload);

    logger.info(
      `[Socket.IO] Emitted order:payment_updated → ${order.order_number || order.id}`,
    );
  } catch (err: any) {
    logger.error(`[Socket.IO] emitOrderPaymentUpdated failed: ${err.message}`);
  }
}

// ─── Notification Events ─────────────────────────────────────────────────────

export function emitNotification(notification: {
  type: string;
  title: string;
  body: string;
}) {
  try {
    const adminNs = getAdminNamespace();
    adminNs.to(ROOMS.NOTIFICATIONS).emit(EVENTS.NOTIFICATION_NEW, {
      notification,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    logger.error(`[Socket.IO] emitNotification failed: ${err.message}`);
  }
}

// ─── Menu Events ─────────────────────────────────────────────────────────────

export function emitProductUpdated(product: any) {
  try {
    const adminNs = getAdminNamespace();
    const publicNs = getPublicNamespace();

    const payload = { product, timestamp: Date.now() };

    adminNs.to(ROOMS.MENU).emit(EVENTS.MENU_PRODUCT_UPDATED, payload);
    publicNs.to(ROOMS.MENU).emit(EVENTS.MENU_PRODUCT_UPDATED, payload);
  } catch (err: any) {
    logger.error(`[Socket.IO] emitProductUpdated failed: ${err.message}`);
  }
}

export function emitAvailabilityChanged(
  productId: string,
  isAvailable: boolean,
) {
  try {
    const adminNs = getAdminNamespace();
    const publicNs = getPublicNamespace();

    const payload = { productId, isAvailable, timestamp: Date.now() };

    adminNs.to(ROOMS.MENU).emit(EVENTS.MENU_AVAILABILITY_CHANGED, payload);
    publicNs.to(ROOMS.MENU).emit(EVENTS.MENU_AVAILABILITY_CHANGED, payload);
  } catch (err: any) {
    logger.error(`[Socket.IO] emitAvailabilityChanged failed: ${err.message}`);
  }
}

// ─── Table Events ────────────────────────────────────────────────────────────

export function emitTableStatusChanged(table: any) {
  try {
    const adminNs = getAdminNamespace();
    adminNs.to(ROOMS.TABLES).emit(EVENTS.TABLE_STATUS_CHANGED, {
      table,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    logger.error(`[Socket.IO] emitTableStatusChanged failed: ${err.message}`);
  }
}

// ─── Settings Events ─────────────────────────────────────────────────────────

export function emitSettingsUpdated(settings: any) {
  try {
    const adminNs = getAdminNamespace();
    const publicNs = getPublicNamespace();

    const payload = { settings, timestamp: Date.now() };

    adminNs.emit(EVENTS.SETTINGS_UPDATED, payload);
    publicNs.emit(EVENTS.SETTINGS_UPDATED, payload);
  } catch (err: any) {
    logger.error(`[Socket.IO] emitSettingsUpdated failed: ${err.message}`);
  }
}
