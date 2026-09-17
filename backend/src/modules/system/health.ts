import type { FastifyInstance } from "fastify";
import { prismaApp, prismaAdmin } from "../../core/config/databaseConfig";
import env from "../../core/config/envConfig";
import currentVersion from "../../core/utils/helpers/version";
import { sendSuccess } from "../../core/utils/common/response";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (_req, res) => {
    let appDbStatus = "down";
    let adminDbStatus = "down";
    let appDbError: string | null = null;
    let adminDbError: string | null = null;

    try {
      await prismaApp.$queryRaw`SELECT 1`;
      appDbStatus = "up";
    } catch (error: any) {
      appDbError = error?.message || "App DB Connection Failed";
    }

    try {
      await prismaAdmin.$queryRaw`SELECT 1`;
      adminDbStatus = "up";
    } catch (error: any) {
      adminDbError = error?.message || "Admin DB Connection Failed";
    }

    const isHealthy = appDbStatus === "up" && adminDbStatus === "up";
    const statusCode = isHealthy ? 200 : 503;

    return sendSuccess(
      res,
      isHealthy ? "Health OK" : "Database Service Degraded",
      statusCode,
      {
        service: env.BUSINESS_NAME || "Maa Tara Sweets",
        version: currentVersion,
        status: isHealthy ? "healthy" : "degraded",
        databases: {
          app: {
            status: appDbStatus,
            ...(appDbError ? { error: appDbError } : {}),
          },
          admin: {
            status: adminDbStatus,
            ...(adminDbError ? { error: adminDbError } : {}),
          },
        },
      }
    );
  });
}
