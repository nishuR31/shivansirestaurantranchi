import { FastifyRequest, FastifyReply } from "fastify";
import { prismaAdmin, prismaAudit } from "../../core/config/databaseConfig";
import logger from "../../core/config/loggerConfig";
import env from "../../core/config/envConfig";

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
    };
    const settings = await fetchWithCache("data:settings", 60, () =>
      prismaAdmin.restaurantSettings.findFirst({ select: PUBLIC_SETTINGS_COLUMNS }),
    );
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
