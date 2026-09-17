import { FastifyInstance } from "fastify";
import authRoutes from "./auth/auth.routes";
import userRoutes from "./users/user.routes";
import orderRoutes from "./orders/order.routes";
import * as orderController from "./orders/order.controller";
import catalogRoutes from "./catalog/catalog.routes";
import reviewRoutes from "./reviews/review.routes";
import settingsRoutes from "./settings/settings.routes";
import systemRoutes from "./system/system.routes";
import governanceRoutes from "./governance/governance.routes";
import { pingRoutes } from "./system/ping";
import { version } from "./system/version";
import { healthRoutes } from "./system/health";

export default async function moduleRoutes(app: FastifyInstance) {
  // Registering domain-based routes
  app.register(authRoutes, { prefix: "/auth" });
  app.register(userRoutes, { prefix: "/data/users" });
  app.register(orderRoutes, { prefix: "/data/orders" });
  app.register(catalogRoutes, { prefix: "/data" });
  app.register(reviewRoutes, { prefix: "/data/reviews" });
  app.register(settingsRoutes, { prefix: "/data/settings" });
  app.register(systemRoutes, { prefix: "/data" });
  app.register(governanceRoutes, { prefix: "/data/governance" });

  // Top-level /customer-profile endpoints (called by frontend /my-orders & /profile)
  app.get("/customer-profile", orderController.getCustomerProfile);
  app.patch("/customer-profile", orderController.updateCustomerProfile);

  // System status endpoints (healthRoutes registered in app.ts at root level)
  app.register(pingRoutes);
  app.register(version);
  app.register(healthRoutes);
}

