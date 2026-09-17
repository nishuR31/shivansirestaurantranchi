import { FastifyInstance } from "fastify";
import * as orderController from "./order.controller";
import { getOrders } from "../catalog/catalog.controller";
import { handleOrderStream } from "./order.stream";
import { authenticate } from "../../core/middlewares/authMiddleware";
import { requireAdmin } from "../../core/middlewares/requireRole";

export default async function orderRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate as any, requireAdmin as any] }, getOrders);
  app.get("/stream", { preHandler: [authenticate as any, requireAdmin as any] }, handleOrderStream);
  app.post("/place", orderController.placeOrder);
  app.get("/public", orderController.getPublicOrder);
  app.post(
    "/history/request-code",
    { config: { rateLimit: { max: 3, timeWindow: "10 minute" } } },
    orderController.requestOrderHistoryCode
  );
  app.post(
    "/history/verify",
    { config: { rateLimit: { max: 10, timeWindow: "10 minute" } } },
    orderController.getOrdersByPhone
  );
  app.patch(
    "/:id/status",
    { preHandler: [authenticate as any, requireAdmin as any] },
    orderController.updateOrderStatus
  );
  app.patch(
    "/:id/payment",
    { preHandler: [authenticate as any, requireAdmin as any] },
    orderController.updatePaymentStatus
  );
  app.post(
    "/:id/rating",
    orderController.submitRating
  );
}
