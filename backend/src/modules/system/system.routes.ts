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
        const { page = "1", limit = "20" } = req.query as { page?: string; limit?: string };
        const take = Math.min(parseInt(limit) || 20, 100);
        const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

        const [logs, total] = await Promise.all([
           prismaAudit.auditLog.findMany({
             orderBy: { createdAt: "desc" },
             take,
             skip,
           }),
           prismaAudit.auditLog.count(),
        ]);
        return res.send({ logs, total, page: skip / take + 1, limit: take });
      } catch (error: any) {
        return res.status(500).send({ error: error.message });
      }
    }
  );

  const resources = [
    "products", "categories", "offers", "discounts", 
    "loyalty_rules", "inventory_items", "restaurant_tables", 
    "restaurant_settings", "app_config", "customers", "orders", "notifications", "reviews"
  ];

  for (const resource of resources) {
    app.post(
      `/crud/${resource}`,
      { preHandler: [authenticate as any, requireAdmin as any] },
      (req, res) => systemController.saveRow(req, res, resource)
    );
    app.delete(
      `/crud/${resource}/:id`,
      { preHandler: [authenticate as any, requireAdmin as any] },
      (req, res) => systemController.deleteRow(req, res, resource)
    );
  }
}
