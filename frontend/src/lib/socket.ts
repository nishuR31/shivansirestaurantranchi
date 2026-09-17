import { io, Socket } from "socket.io-client";

// Get base URL for socket connections
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
// Clean up URL and get domain (remove /api/v1 if present)
const SOCKET_URL = API_BASE_URL.replace("/api/v1", "");

let adminSocket: Socket | null = null;
let publicSocket: Socket | null = null;

// Ensure public socket exists
export function getPublicSocket(): Socket {
  if (!publicSocket) {
    publicSocket = io(`${SOCKET_URL}/public`, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ["websocket", "polling"],
    });

    publicSocket.on("connect_error", (error) => {
      console.warn("[Socket.IO Public] Connection error:", error.message);
    });
  }
  return publicSocket;
}

// Connect admin socket with authentication
export function connectAdminSocket(): Socket {
  if (!adminSocket) {
    adminSocket = io(`${SOCKET_URL}/admin`, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    adminSocket.on("connect_error", (error) => {
      console.warn("[Socket.IO Admin] Connection error:", error.message);
    });

    adminSocket.on("disconnect", (reason) => {
      console.warn("[Socket.IO Admin] Disconnected:", reason);
    });
  } else if (!adminSocket.connected) {
    adminSocket.connect();
  }
  return adminSocket;
}

// Disconnect admin socket
export function disconnectAdminSocket(): void {
  if (adminSocket) {
    adminSocket.disconnect();
    adminSocket = null;
  }
}
