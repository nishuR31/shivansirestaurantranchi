import { FastifyInstance } from "fastify";
import { Server, Namespace, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { JWT_ACCESS_SECRET, WEB_ORIGIN, NODE_ENV } from "./envConfig";
import logger from "./loggerConfig";

let io: Server | null = null;

// ─── Room constants ──────────────────────────────────────────────────────────
export const ROOMS = {
  ORDERS: "orders",
  NOTIFICATIONS: "notifications",
  MENU: "menu",
  TABLES: "tables",
  order: (id: string) => `order:${id}`,
  table: (id: number) => `table:${id}`,
} as const;

// ─── Event types ─────────────────────────────────────────────────────────────
export const EVENTS = {
  // Orders
  ORDER_CREATED: "order:created",
  ORDER_UPDATED: "order:updated",
  ORDER_STATUS_CHANGED: "order:status_changed",
  ORDER_PAYMENT_UPDATED: "order:payment_updated",
  // Notifications
  NOTIFICATION_NEW: "notification:new",
  // Menu
  MENU_PRODUCT_UPDATED: "menu:product_updated",
  MENU_AVAILABILITY_CHANGED: "menu:availability_changed",
  // Tables
  TABLE_STATUS_CHANGED: "table:status_changed",
  // Settings
  SETTINGS_UPDATED: "settings:updated",
  // Connection
  CONNECTION_STATUS: "connection:status",
} as const;

// ─── JWT Auth middleware for admin namespace ──────────────────────────────────
function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  try {
    // Check cookie first, then auth header, then handshake query
    const cookieHeader = socket.handshake.headers.cookie;
    let token: string | undefined;

    if (cookieHeader) {
      const cookies = cookieHeader.split(";").reduce(
        (acc, c) => {
          const [k, ...v] = c.trim().split("=");
          if (k) acc[k] = v.join("=");
          return acc;
        },
        {} as Record<string, string>,
      );
      token = cookies["accessToken"];
    }

    if (!token) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      token = socket.handshake.auth?.token;
    }

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as {
      id: string;
      role: string;
      email: string;
    };

    if (decoded.role !== "ADMIN" && decoded.role !== "SUPERADMIN") {
      return next(new Error("Admin access required"));
    }

    // Attach user info to socket data
    (socket as any).user = decoded;
    next();
  } catch (err: any) {
    logger.error(`Socket auth error: ${err.message}`);
    next(new Error("Invalid or expired token"));
  }
}

// ─── Initialize Socket.IO ────────────────────────────────────────────────────
export function initializeSocketIO(server: FastifyInstance): Server {
  if (io) return io;

  io = new Server(server.server, {
    cors: {
      origin: NODE_ENV === "production" ? WEB_ORIGIN : true,
      credentials: true,
    },
    pingInterval: 15000,
    pingTimeout: 10000,
    transports: ["websocket", "polling"],
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: false,
    },
  });

  // ─── Admin namespace (authenticated) ─────────────────────────────────────
  const adminNs = io.of("/admin");
  adminNs.use(authenticateSocket);

  adminNs.on("connection", (socket) => {
    const user = (socket as any).user;
    logger.info(`[Socket.IO] Admin connected: ${user.email} (${socket.id})`);

    // Auto-join admin rooms
    socket.join(ROOMS.ORDERS);
    socket.join(ROOMS.NOTIFICATIONS);
    socket.join(ROOMS.MENU);
    socket.join(ROOMS.TABLES);

    socket.emit(EVENTS.CONNECTION_STATUS, {
      connected: true,
      user: { id: user.id, email: user.email, role: user.role },
      rooms: [ROOMS.ORDERS, ROOMS.NOTIFICATIONS, ROOMS.MENU, ROOMS.TABLES],
      timestamp: Date.now(),
    });

    socket.on("disconnect", (reason) => {
      logger.info(
        `[Socket.IO] Admin disconnected: ${user.email} (${reason})`,
      );
    });

    socket.on("error", (err) => {
      logger.error(`[Socket.IO] Admin socket error: ${err.message}`);
    });

    // Handle incoming duplex API requests natively through socket
    socket.on("api:request", async (payload: { url: string; method: string; data?: any }, callback: (res: any) => void) => {
      try {
        const response = await server.inject({
          method: payload.method as any,
          url: "/api/v1" + payload.url,
          payload: payload.data,
          headers: socket.handshake.headers, // Forward cookies/auth
        });
        
        let data = response.payload;
        try { data = JSON.parse(data); } catch (e) {}

        if (response.statusCode >= 400) {
          callback({ error: data });
        } else {
          callback({ data });
        }
      } catch (err: any) {
        callback({ error: err.message || "Internal Server Error" });
      }
    });
  });

  // ─── Public namespace (customer order tracking) ──────────────────────────
  const publicNs = io.of("/public");

  publicNs.on("connection", (socket) => {
    logger.info(`[Socket.IO] Public client connected: ${socket.id}`);

    // Clients join specific order rooms for tracking
    socket.on("track:order", (data: { orderId: string; token: string }) => {
      if (data.orderId && data.token) {
        const roomName = ROOMS.order(data.orderId);
        socket.join(roomName);
        socket.emit("tracking:joined", {
          orderId: data.orderId,
          room: roomName,
        });
        logger.info(
          `[Socket.IO] Client ${socket.id} tracking order ${data.orderId}`,
        );
      }
    });

    socket.on("untrack:order", (data: { orderId: string }) => {
      if (data.orderId) {
        socket.leave(ROOMS.order(data.orderId));
      }
    });

    // Menu updates room — public can listen for availability changes
    socket.on("subscribe:menu", () => {
      socket.join(ROOMS.MENU);
    });

    socket.on("disconnect", (reason) => {
      logger.info(
        `[Socket.IO] Public client disconnected: ${socket.id} (${reason})`,
      );
    });

    // Handle incoming duplex API requests natively through socket
    socket.on("api:request", async (payload: { url: string; method: string; data?: any }, callback: (res: any) => void) => {
      try {
        const response = await server.inject({
          method: payload.method as any,
          url: "/api/v1" + payload.url,
          payload: payload.data,
          headers: socket.handshake.headers, // Forward cookies/auth
        });
        
        let data = response.payload;
        try { data = JSON.parse(data); } catch (e) {}

        if (response.statusCode >= 400) {
          callback({ error: data });
        } else {
          callback({ data });
        }
      } catch (err: any) {
        callback({ error: err.message || "Internal Server Error" });
      }
    });
  });

  logger.info("[Socket.IO] Server initialized with /admin and /public namespaces");
  return io;
}

// ─── Getters ─────────────────────────────────────────────────────────────────
export function getIO(): Server {
  if (!io) {
    throw new Error(
      "Socket.IO not initialized. Call initializeSocketIO() first.",
    );
  }
  return io;
}

export function getAdminNamespace(): Namespace {
  return getIO().of("/admin");
}

export function getPublicNamespace(): Namespace {
  return getIO().of("/public");
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────
export async function closeSocketIO(): Promise<void> {
  if (io) {
    await new Promise<void>((resolve) => {
      io!.close(() => {
        logger.info("[Socket.IO] Server closed");
        io = null;
        resolve();
      });
    });
  }
}
