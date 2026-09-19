import app from "./app";
import { API_PORT, NODE_ENV } from "./core/config/envConfig";
import logger from "./core/config/loggerConfig";
import {
  cache,
  connectRedisCache,
  connectRedisRateLimit,
  rateLimit,
} from "./core/config/redisConfig";
import {
  initializeSocketIO,
  closeSocketIO,
} from "./core/config/socketConfig";

const startServer = async () => {
  try {
    await Promise.all([connectRedisCache(), connectRedisRateLimit()]);
    const address = await app.listen({ port: API_PORT, host: "0.0.0.0" });

    // Initialize Socket.IO after the HTTP server is ready
    initializeSocketIO(app);
    logger.info(`[Socket.IO] Real-time server attached to ${address}`);
  } catch (err: any) {
    logger.error(err?.message || err);
    process.exit(1);
  }
};

startServer();
let isShuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`\n Received ${signal}. Shutting down gracefully…`);

  // Close Socket.IO first (gracefully disconnect all clients)
  try {
    await closeSocketIO();
  } catch (err) {
    logger.error({ error: err }, "Error closing Socket.IO");
  }

  app.close(async () => {
    logger.info("HTTP server closed.");

    try {
      await Promise.all([
        cache.disconnect(), 
        rateLimit.disconnect(),
        import("./core/config/databaseConfig").then(db => Promise.all([
          db.prismaApp.$disconnect(),
          db.prismaAdmin.$disconnect(),
          db.prismaAudit.$disconnect()
        ]))
      ]);
    } catch (err) {
      logger.error({ error: err }, "Error disconnecting databases");
    }

    logger.info("All connections closed. Goodbye!");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Shutdown timed out. Forcing exit.");
    process.exit(1);
  }, 10_000);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("unhandledRejection", (reason: any) => {
  logger.error({ error: reason?.message || reason }, "Unhandled Rejection");
});

process.on("uncaughtException", (error: Error) => {
  logger.error(
    {
      error: error.message,
      stack: error.stack,
    },
    "Uncaught Exception",
  );
  process.exit(1);
});

