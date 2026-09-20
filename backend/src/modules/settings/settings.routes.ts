import { FastifyInstance } from "fastify";
import * as settingsController from "./settings.controller";
import { authenticate } from "../../core/middlewares/authMiddleware";
import { requireSuperAdmin } from "../../core/middlewares/requireRole";

export default async function settingsRoutes(app: FastifyInstance) {
  app.get("/", settingsController.getSettings);
  app.get(
    "/owner",
    { preHandler: [authenticate as any, requireSuperAdmin as any] },
    settingsController.getOwnerSettings,
  );
  app.post(
    "/owner",
    { preHandler: [authenticate as any, requireSuperAdmin as any] },
    settingsController.saveOwnerSettings,
  );
  app.post(
    "/config",
    { preHandler: [authenticate as any, requireSuperAdmin as any] },
    settingsController.saveAppConfig,
  );
  app.post(
    "/lockdown/enable",
    { preHandler: [authenticate as any, requireSuperAdmin as any] },
    settingsController.enableLockdown,
  );
  app.post(
    "/lockdown/disable",
    { preHandler: [authenticate as any, requireSuperAdmin as any] },
    settingsController.disableLockdown,
  );
}
