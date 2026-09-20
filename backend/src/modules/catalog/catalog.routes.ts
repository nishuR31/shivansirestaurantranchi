import { FastifyInstance } from "fastify";
import * as catalogController from "./catalog.controller";
import { authenticate } from "../../core/middlewares/authMiddleware";
import { requireAdmin } from "../../core/middlewares/requireRole";

export default async function catalogRoutes(app: FastifyInstance) {
  app.get("/categories", catalogController.getCategories);
  app.get("/products", catalogController.getProducts);
  app.get("/offers", catalogController.getOffers);
  app.get("/discounts", catalogController.getDiscounts);
  app.get("/loyalty", catalogController.getLoyaltyRules);
  app.get("/tables", catalogController.getTables);
  
  app.get(
    "/inventory",
    { preHandler: [authenticate as any, requireAdmin as any] },
    catalogController.getInventory
  );
  app.get(
    "/customers",
    { preHandler: [authenticate as any, requireAdmin as any] },
    catalogController.getCustomers
  );
  app.get(
    "/notifications",
    { preHandler: [authenticate as any, requireAdmin as any] },
    catalogController.getNotifications
  );

  app.post(
    "/upload-image",
    { preHandler: [authenticate as any, requireAdmin as any] },
    catalogController.uploadProductImage
  );

  app.delete(
    "/upload-image",
    { preHandler: [authenticate as any, requireAdmin as any] },
    catalogController.deleteProductImage
  );
}
