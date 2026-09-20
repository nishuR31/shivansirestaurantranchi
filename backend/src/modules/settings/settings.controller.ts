import { FastifyRequest, FastifyReply } from "fastify";
import { prismaAdmin, prismaAudit } from "../../core/config/databaseConfig";
import logger from "../../core/config/loggerConfig";
import env from "../../core/config/envConfig";
import bcrypt from "bcrypt";

import { fetchWithCache, cache } from "../../core/config/redisConfig";
import { emitSettingsUpdated } from "../../core/providers/socketEmitter";

export const getSettings = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const PUBLIC_SETTINGS_COLUMNS = {
      id: true,
      name: true,
      tagline: true,
      logo_url: true,
      banner_url: true,
      address: true,
      phone: true,
      gst_number: true,
      upi_id: true,
      opening_time: true,
      closing_time: true,
      tax_percent: true,
      packing_charge: true,
      delivery_charge: true,
      currency: true,
      theme: true,
      is_suspended: true,
      shutdown_code: true,
      shutdown_message: true,
      lockdown_password: true,
    };
    const settings = await fetchWithCache("data:settings", 60, async () => {
      const raw = await prismaAdmin.restaurantSettings.findFirst({ select: PUBLIC_SETTINGS_COLUMNS });
      if (!raw) return null;
      // Expose only a boolean flag, never the hash
      const { lockdown_password, ...rest } = raw as any;
      return { ...rest, has_lockdown_password: Boolean(lockdown_password) };
    });
    return res.send(settings || null);
  } catch (error: any) {
    logger.error(`Error in getSettings: ${error.message}`);
    return res.status(500).send({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Internal Server Error" } });
  }
};

export const getOwnerSettings = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const settings = await prismaAdmin.restaurantSettings.findFirst();
    const config = await prismaAdmin.appConfig.findFirst();

    return res.send({
      ownerEmail: config?.owner_email ?? "",
      whatsappPhoneNumberId: config?.whatsapp_phone_number_id ?? "",
      whatsappToken: config?.whatsapp_token ? "***" : "", // do not expose actual token
    });
  } catch (error: any) {
    logger.error(`Error in getOwnerSettings: ${error.message}`);
    return res.status(500).send({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: error.message } });
  }
};

export const saveOwnerSettings = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const data = req.body as any;
    // Don't update id
    delete data.id;
    // Lockdown fields are managed by dedicated endpoints only
    delete data.lockdown_password;

    // Let the owner update any setting directly, including suspension

    const settings = await prismaAdmin.restaurantSettings.findFirst();
    if (!settings) {
      await prismaAdmin.restaurantSettings.create({
        data: { name: env.BUSINESS_NAME, ...data },
      });
    } else {
      await prismaAdmin.restaurantSettings.updateMany({
        data,
      });
    }

    if (cache) {
      await cache.del("data:settings");
    }
    
    // Notify clients of the updated settings in realtime
    emitSettingsUpdated({
      is_suspended: data.is_suspended,
      shutdown_code: data.shutdown_code,
      shutdown_message: data.shutdown_message
    });

    const user = req.user as any;
    if (user && (user.role === "ADMIN" || user.role === "SUPERADMIN")) {
      await prismaAudit.auditLog.create({
        data: {
          adminId: user.id,
          adminEmail: user.email || "unknown",
          action: "UPDATE",
          table: "restaurant_settings",
          recordId: "global",
        }
      }).catch(err => logger.error(`Failed to write audit log: ${err.message}`));
    }

    return res.send({ ok: true });
  } catch (error: any) {
    logger.error(`Error in saveOwnerSettings: ${error.message}`);
    return res.status(500).send({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: error.message } });
  }
};

export const saveAppConfig = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { ownerEmail, whatsappPhoneNumberId, whatsappToken } = req.body as any;

    const config = await prismaAdmin.appConfig.findFirst();
    const configData: any = {
      whatsapp_phone_number_id: whatsappPhoneNumberId,
    };
    if (whatsappToken) {
      configData.whatsapp_token = whatsappToken;
    }

    if (config) {
      await prismaAdmin.appConfig.update({
        where: { id: config.id },
        data: configData,
      });
    } else {
      await prismaAdmin.appConfig.create({
        data: configData,
      });
    }

    const user = req.user as any;
    if (user && (user.role === "ADMIN" || user.role === "SUPERADMIN")) {
      await prismaAudit.auditLog.create({
        data: {
          adminId: user.id,
          adminEmail: user.email || "unknown",
          action: "UPDATE",
          table: "app_config",
          recordId: "global",
        }
      }).catch(err => logger.error(`Failed to write audit log: ${err.message}`));
    }

    return res.send({ ok: true });
  } catch (error: any) {
    logger.error(`Error in saveOwnerSettings: ${error.message}`);
    return res.status(500).send({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: error.message } });
  }
};

export const enableLockdown = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const user = req.user as any;
    const { shutdown_code, shutdown_message, lockdown_password } = req.body as any;

    if (!lockdown_password || typeof lockdown_password !== "string" || lockdown_password.length < 4) {
      return res.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Lockdown password is required (min 4 characters)" }
      });
    }

    const settings = await prismaAdmin.restaurantSettings.findFirst();
    if (!settings) {
      return res.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Restaurant settings not found" }
      });
    }

    if (settings.is_suspended) {
      return res.status(409).send({
        success: false,
        error: { code: "ALREADY_LOCKED", message: "Lockdown is already active" }
      });
    }

    // Hash the lockdown password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(lockdown_password, salt);

    await prismaAdmin.restaurantSettings.updateMany({
      data: {
        is_suspended: true,
        shutdown_code: shutdown_code ? Number(shutdown_code) : 503,
        shutdown_message: shutdown_message || "Restaurant is temporarily unavailable.",
        lockdown_password: hashedPassword,
      }
    });

    if (cache) await cache.del("data:settings");

    emitSettingsUpdated({
      is_suspended: true,
      shutdown_code: shutdown_code ? Number(shutdown_code) : 503,
      shutdown_message: shutdown_message || "Restaurant is temporarily unavailable.",
    });

    await prismaAudit.auditLog.create({
      data: {
        adminId: user.id,
        adminEmail: user.email || "unknown",
        action: "ENABLE_LOCKDOWN",
        table: "restaurant_settings",
        recordId: "global",
      }
    }).catch(err => logger.error(`Failed to write audit log: ${err.message}`));

    return res.send({ success: true, message: "Lockdown activated" });
  } catch (error: any) {
    logger.error(`Error in enableLockdown: ${error.message}`);
    return res.status(500).send({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: error.message } });
  }
};

export const disableLockdown = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const user = req.user as any;
    const { lockdown_password } = req.body as any;

    if (!lockdown_password || typeof lockdown_password !== "string") {
      return res.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Lockdown password is required to disable lockdown" }
      });
    }

    const settings = await prismaAdmin.restaurantSettings.findFirst();
    if (!settings) {
      return res.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Restaurant settings not found" }
      });
    }

    if (!settings.is_suspended) {
      return res.status(409).send({
        success: false,
        error: { code: "NOT_LOCKED", message: "Lockdown is not currently active" }
      });
    }

    if (!settings.lockdown_password) {
      return res.status(500).send({
        success: false,
        error: { code: "NO_PASSWORD", message: "Lockdown has no password set — contact system admin" }
      });
    }

    // Verify the password
    const isMatch = await bcrypt.compare(lockdown_password, settings.lockdown_password);
    if (!isMatch) {
      await prismaAudit.auditLog.create({
        data: {
          adminId: user.id,
          adminEmail: user.email || "unknown",
          action: "FAILED_UNLOCK_LOCKDOWN",
          table: "restaurant_settings",
          recordId: "global",
        }
      }).catch(err => logger.error(`Failed to write audit log: ${err.message}`));

      return res.status(403).send({
        success: false,
        error: { code: "WRONG_PASSWORD", message: "Incorrect lockdown password" }
      });
    }

    await prismaAdmin.restaurantSettings.updateMany({
      data: {
        is_suspended: false,
        shutdown_code: null,
        shutdown_message: null,
        lockdown_password: null,
      }
    });

    if (cache) await cache.del("data:settings");

    emitSettingsUpdated({
      is_suspended: false,
      shutdown_code: null,
      shutdown_message: null,
    });

    await prismaAudit.auditLog.create({
      data: {
        adminId: user.id,
        adminEmail: user.email || "unknown",
        action: "DISABLE_LOCKDOWN",
        table: "restaurant_settings",
        recordId: "global",
      }
    }).catch(err => logger.error(`Failed to write audit log: ${err.message}`));

    return res.send({ success: true, message: "Lockdown disabled" });
  } catch (error: any) {
    logger.error(`Error in disableLockdown: ${error.message}`);
    return res.status(500).send({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: error.message } });
  }
};
