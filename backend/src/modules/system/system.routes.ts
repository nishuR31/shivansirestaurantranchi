import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as systemController from "./system.controller";
import { authenticate } from "../../core/middlewares/authMiddleware";
import { requireAdmin, requireSuperAdmin } from "../../core/middlewares/requireRole";

import { prismaAudit } from "../../core/config/databaseConfig";

export default async function systemRoutes(app: FastifyInstance) {
  app.get(
    "/audit-logs",
    { preHandler: [authenticate as any, requireSuperAdmin as any] },
    async (req: FastifyRequest, res: FastifyReply) => {
      try {
        const logs = await prismaAudit.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 100,
        });
        return res.send(logs);
      } catch (error: any) {
        return res.status(500).send({ error: error.message });
      }
    }
  );

  app.post(
    "/crud/:table",
    { preHandler: [authenticate as any, requireAdmin as any] },
    systemController.saveRow,
  );
  app.delete(
    "/crud/:table/:id",
    {
      preHandler: [authenticate as any, requireAdmin as any],
    },
    systemController.deleteRow
  );
}
