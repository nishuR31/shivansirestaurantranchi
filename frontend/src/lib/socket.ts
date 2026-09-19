import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env["VITE_SOCKET_URL"];

if (!SOCKET_URL) {
  console.warn("VITE_SOCKET_URL is not defined in environment variables. Real-time features may not work.");
}

let adminSocket: Socket | null = null;
let publicSocket: Socket | null = null;

function setupDiagnosticLogging(socket: Socket, namespace: string) {
  let connectErrorCount = 0;

  socket.on("connect", () => {
    connectErrorCount = 0;
    console.log(`[Socket.IO ${namespace}] Connected (ID: ${socket.id}, Transport: ${socket.io.engine.transport.name})`);
  });

  socket.on("connect_error", (error) => {
    connectErrorCount++;
    if (connectErrorCount <= 3) {
      console.warn(`[Socket.IO ${namespace}] Connection error (attempt ${connectErrorCount}):`, error.message);
    } else if (connectErrorCount === 10) {
      console.warn(`[Socket.IO ${namespace}] Connection failed 10 times. Suppressing further warnings.`);
    } else {
      console.debug(`[Socket.IO ${namespace}] Connection error (attempt ${connectErrorCount}):`, error.message);
    }
  });

  socket.on("disconnect", (reason) => {
    console.warn(`[Socket.IO ${namespace}] Disconnected:`, reason);
  });
}

export function getPublicSocket(): Socket {
  if (!publicSocket) {
    publicSocket = io(`${SOCKET_URL}/public`, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 10000,
      transports: ["websocket", "polling"],
    });

    setupDiagnosticLogging(publicSocket, "Public");
  }
  return publicSocket;
}

export function connectAdminSocket(): Socket {
  if (!adminSocket) {
    adminSocket = io(`${SOCKET_URL}/admin`, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 10000,
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    setupDiagnosticLogging(adminSocket, "Admin");
  } else if (!adminSocket.connected) {
    adminSocket.connect();
  }
  return adminSocket;
}

export function disconnectAdminSocket(): void {
  if (adminSocket) {
    adminSocket.disconnect();
    adminSocket = null;
  }
}
