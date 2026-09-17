import type { FastifyInstance } from "fastify";
import env from "../../core/config/envConfig";
import currentVersion from "../../core/utils/helpers/version";
import { sendSuccess } from "../../core/utils/common/response";

export async function pingRoutes(app: FastifyInstance) {
  app.get("/ping", async (req: any, res: any) => {
    return sendSuccess(res, "pong", 200, {
      service: env.BUSINESS_NAME || "RanchiKart",
      version: currentVersion,
    });
  });
}
