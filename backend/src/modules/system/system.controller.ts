import { FastifyRequest, FastifyReply } from "fastify";
import {
  prismaApp,
  prismaAdmin,
  prismaAudit,
} from "../../core/config/databaseConfig";
import logger from "../../core/config/loggerConfig";
import { cache } from "../../core/config/redisConfig";
import { 
  emitProductUpdated, 
  emitAvailabilityChanged, 
  emitSettingsUpdated, 
  emitTableStatusChanged 
} from "../../core/providers/socketEmitter";
import { crudSchemas } from "./system.schemas";

// Map frontend table names to Prisma model names
const modelMap: Record<string, any> = {
  products: "product",
  categories: "category",
  offers: "offer",
  discounts: "discount",
  loyalty_rules: "loyaltyRule",
  inventory_items: "inventoryItem",
  restaurant_tables: "restaurantTable",
  restaurant_settings: "restaurantSettings",
  app_config: "appConfig",
};

// Map frontend table names to Redis cache keys
const cacheKeyMap: Record<string, string> = {
  products: "data:products",
  categories: "data:categories",
  offers: "data:offers",
  discounts: "data:discounts",
  loyalty_rules: "data:loyaltyRules",
  inventory_items: "data:inventory",
  restaurant_tables: "data:tables",
  customers: "data:customers",
  orders: "data:orders",
  notifications: "data:notifications",
  restaurant_settings: "data:settings",
};

export const saveRow = async (req: FastifyRequest, res: FastifyReply, table: string) => {
  try {
    let data = req.body as any;

    const modelName = modelMap[table];
    if (!modelName) {
      return res.status(400).send({ success: false, error: { code: "INVALID_TABLE", message: `Invalid table: ${table}` } });
    }

    // Convert string dates to Date objects for Prisma
    for (const key of Object.keys(data)) {
      if ((key.endsWith("_at") || key.endsWith("_date")) && typeof data[key] === "string") {
        const parsed = new Date(data[key]);
        if (!isNaN(parsed.getTime())) {
          data[key] = parsed;
        }
      }
    }

    // Validation with Zod Schema if defined
    if (crudSchemas[table]) {
      const parsedData = crudSchemas[table].safeParse(data);
      if (!parsedData.success) {
        return res.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message: "Validation failed",
            details: parsedData.error.issues,
          }
        });
      }
      // Re-assign validated data
      data = parsedData.data;
    } else {
      // Fallback Backend validation for percent limits
      if (data.discount_percent !== undefined) {
        const p = Number(data.discount_percent);
        if (p < 0 || p > 100) return res.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Discount percent must be between 0 and 100" } });
      }
      if (table === "discounts" && data.type === "percent" && data.value !== undefined) {
        const v = Number(data.value);
        if (v < 0 || v > 100) return res.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Percentage value must be between 0 and 100" } });
      }

      if (table === "discounts" || table === "offers") {
        if (data.category_ids === undefined) data.category_ids = [];
        if (data.product_ids === undefined) data.product_ids = [];
      }
    }

    const user = req.user as any;
    // Intercept SUPERADMIN actions on restaurant_settings for multi-sig governance
    if (table === "restaurant_settings" && data.is_suspended !== undefined) {
      const currentSettings = await prismaAdmin.restaurantSettings.findFirst();
      if (currentSettings && currentSettings.is_suspended !== data.is_suspended) {
         if (user?.role === "SUPERADMIN") {
            return res.status(403).send({ 
              success: false,
              error: {
                code: "GOVERNANCE_REQUIRED", 
                message: "Modifying suspension status requires a Governance Proposal. Please submit it through the Governance tab."
              }
            });
         }
      }
    }

    let delegate = (prismaApp as any)[modelName];
    if (!delegate) delegate = (prismaAdmin as any)[modelName];

    if (data.id) {
      // Update
      const updated = await delegate.update({
        where: { id: data.id },
        data,
      });
      if (cacheKeyMap[table]) await cache.del(cacheKeyMap[table]);

      if (table === "products") {
        emitProductUpdated(updated);
        if (data.is_available !== undefined) {
          emitAvailabilityChanged(updated.id, updated.is_available);
        }
      } else if (table === "restaurant_settings") {
        emitSettingsUpdated(updated);
      } else if (table === "restaurant_tables") {
        emitTableStatusChanged(updated);
      }

      if (user && (user.role === "ADMIN" || user.role === "SUPERADMIN") && ["restaurant_settings", "app_config"].includes(table)) {
        await prismaAudit.auditLog.create({
          data: {
            adminId: user.id,
            adminEmail: user.email || "unknown",
            action: "UPDATE",
            table: table,
            recordId: updated.id,
          }
        }).catch(err => logger.error(`Failed to write audit log: ${err.message}`));
      }

      return res.send(updated);
    } else {
      // Insert
      const inserted = await delegate.create({
        data,
      });
      if (cacheKeyMap[table]) await cache.del(cacheKeyMap[table]);

      if (table === "products") {
        emitProductUpdated(inserted);
      } else if (table === "restaurant_settings") {
        emitSettingsUpdated(inserted);
      } else if (table === "restaurant_tables") {
        emitTableStatusChanged(inserted);
      }

      if (user && (user.role === "ADMIN" || user.role === "SUPERADMIN") && ["restaurant_settings", "app_config"].includes(table)) {
        await prismaAudit.auditLog.create({
          data: {
            adminId: user.id,
            adminEmail: user.email || "unknown",
            action: "CREATE",
            table: table,
            recordId: inserted.id,
          }
        }).catch(err => logger.error(`Failed to write audit log: ${err.message}`));
      }

      return res.send(inserted);
    }
  } catch (error: any) {
    logger.error(`Error in saveRow (${(req.params as any).table}): ${error.message}`);
    return res.status(500).send({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong"
      }
    });
  }
};

export const deleteRow = async (req: FastifyRequest, res: FastifyReply, table: string) => {
  try {
    const { id } = req.params as any;

    const modelName = modelMap[table];
    if (!modelName) {
      return res.status(400).send({ 
        success: false, 
        error: { code: "INVALID_TABLE", message: `Invalid table: ${table}` } 
      });
    }

    let delegate = (prismaApp as any)[modelName];
    if (!delegate) delegate = (prismaAdmin as any)[modelName];

    await delegate.delete({
      where: { id },
    });

    if (cacheKeyMap[table]) await cache.del(cacheKeyMap[table]);

    if (table === "products") {
      emitProductUpdated({ id });
    } else if (table === "restaurant_settings") {
      emitSettingsUpdated({ id });
    } else if (table === "restaurant_tables") {
      emitTableStatusChanged({ id });
    }

    // Log destructive action to Audit DB
    const user = req.user as any;
    if (user && (user.role === "ADMIN" || user.role === "SUPERADMIN")) {
      try {
        await prismaAudit.auditLog.create({
          data: {
            adminId: user.id,
            adminEmail: user.email || "unknown",
            action: "DELETE",
            table: table,
            recordId: id,
          }
        });
      } catch (auditErr: any) {
        logger.error(`Failed to write audit log for deleteRow: ${auditErr.message}`);
      }
    }

    return res.send({ ok: true });
  } catch (error: any) {
    logger.error(`Error in deleteRow (${(req.params as any).table}): ${error.message}`);
    return res.status(500).send({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong"
      }
    });
  }
};
