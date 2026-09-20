import { FastifyRequest, FastifyReply } from "fastify";
import { prismaApp } from "../../core/config/databaseConfig";
import logger from "../../core/config/loggerConfig";
import { fetchWithCache } from "../../core/config/redisConfig";
import { normalizePhone } from "../../core/utils/phone";
import { NODE_ENV } from "../../core/config/envConfig";

export const getCategories = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const categories = await fetchWithCache("data:categories", 60, () =>
      prismaApp.category.findMany({ orderBy: { sort_order: "asc" } }),
    );
    return res.send(categories);
  } catch (error: any) {
    logger.error(`Error in getCategories: ${error.message}`);
    return res.status(500).send({ error: NODE_ENV === "development" ? error.message : "Internal Server Error" });
  }
};

export const getProducts = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const products = await fetchWithCache("data:products", 60, () =>
      prismaApp.product.findMany({
        orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      }),
    );
    return res.send(products);
  } catch (error: any) {
    logger.error(`Error in getProducts: ${error.message}`);
    return res.status(500).send({ error: NODE_ENV === "development" ? error.message : "Internal Server Error" });
  }
};

export const getOffers = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const offers = await fetchWithCache("data:offers", 60, () =>
      prismaApp.offer.findMany({ orderBy: { id: "desc" } }),
    );
    return res.send(offers);
  } catch (error: any) {
    logger.error(`Error in getOffers: ${error.message}`);
    return res.status(500).send({ error: NODE_ENV === "development" ? error.message : "Internal Server Error" });
  }
};

export const getDiscounts = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const discounts = await fetchWithCache("data:discounts", 60, () =>
      prismaApp.discount.findMany({ orderBy: { id: "desc" } }),
    );
    return res.send(discounts);
  } catch (error: any) {
    logger.error(`Error in getDiscounts: ${error.message}`);
    return res.status(500).send({ error: NODE_ENV === "development" ? error.message : "Internal Server Error" });
  }
};

export const getLoyaltyRules = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const rules = await fetchWithCache("data:loyaltyRules", 60, () =>
      prismaApp.loyaltyRule.findMany({ orderBy: { visits_required: "asc" } }),
    );
    return res.send(rules);
  } catch (error: any) {
    logger.error(`Error in getLoyaltyRules: ${error.message}`);
    return res.status(500).send({ error: NODE_ENV === "development" ? error.message : "Internal Server Error" });
  }
};

export const getTables = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const tables = await fetchWithCache("data:tables", 60, () =>
      prismaApp.restaurantTable.findMany({ orderBy: { table_number: "asc" } }),
    );
    return res.send(tables);
  } catch (error: any) {
    logger.error(`Error in getTables: ${error.message}`);
    return res.status(500).send({ error: NODE_ENV === "development" ? error.message : "Internal Server Error" });
  }
};

export const getInventory = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const inventory = await fetchWithCache("data:inventory", 60, () =>
      prismaApp.inventoryItem.findMany({ orderBy: { name: "asc" } }),
    );
    return res.send(inventory);
  } catch (error: any) {
    logger.error(`Error in getInventory: ${error.message}`);
    return res.status(500).send({ error: NODE_ENV === "development" ? error.message : "Internal Server Error" });
  }
};

export const getCustomers = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const customers = await fetchWithCache("data:customers", 60, () =>
      prismaApp.user.findMany({
        where: { role: "USER" },
        orderBy: { total_spend: "desc" },
      }),
    );

    // Group by normalized phone number to merge duplicates created before normalization
    const grouped = new Map<string, any>();
    for (const u of customers) {
      if (!u.phone) continue;
      const np = normalizePhone(u.phone);
      if (grouped.has(np)) {
        const existing = grouped.get(np);
        existing.visits += u.visits;
        existing.reward_points += u.reward_points;
        existing.total_spend = Number(existing.total_spend) + Number(u.total_spend);
        if (u.last_visit && (!existing.last_visit || u.last_visit > existing.last_visit)) {
          existing.last_visit = u.last_visit;
        }
      } else {
        grouped.set(np, {
          ...u,
          phone: np,
          total_spend: Number(u.total_spend),
        });
      }
    }

    const merged = Array.from(grouped.values()).sort((a, b) => b.total_spend - a.total_spend);
    return res.send(merged);
  } catch (error: any) {
    logger.error(`Error in getCustomers: ${error.message}`);
    return res.status(500).send({ error: NODE_ENV === "development" ? error.message : "Internal Server Error" });
  }
};

export const getOrders = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const orders = await prismaApp.order.findMany({
      include: { order_items: true },
      orderBy: { created_at: "desc" },
      take: 100,
    });
    return res.send(orders);
  } catch (error: any) {
    logger.error(`Error in getOrders: ${error.message}`);
    return res.status(500).send({ error: NODE_ENV === "development" ? error.message : "Internal Server Error" });
  }
};

export const getNotifications = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const notifications = await prismaApp.appNotification.findMany({
      orderBy: { created_at: "desc" },
      take: 60,
    });
    return res.send(notifications);
  } catch (error: any) {
    logger.error(`Error in getNotifications: ${error.message}`);
    return res.status(500).send({ error: NODE_ENV === "development" ? error.message : "Internal Server Error" });
  }
};

// ─── POST /upload-image ───────────────────────────────────────────────────────
// Admin: Upload an image via multipart → Sharp → Supabase Storage → return URL
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_STORAGE_BUCKET,
} from "../../core/config/envConfig";

function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env",
    );
  }
  return createClient(SUPABASE_URL.trim(), SUPABASE_SERVICE_ROLE_KEY.trim());
}

export const uploadProductImage = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const data = await req.file();
    if (!data) return res.status(400).send({ error: "No file uploaded" });

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(data.mimetype)) {
      return res
        .status(400)
        .send({ error: "Only JPEG, PNG, WebP, or GIF images are allowed" });
    }

    // Read the raw buffer from the multipart stream
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer);
    }
    const rawBuffer = Buffer.concat(chunks);

    // Compress & convert to WebP via Sharp (max 800px wide, quality 80)
    const optimized = await sharp(rawBuffer)
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const supabase = getSupabaseAdmin();
    const bucket = SUPABASE_STORAGE_BUCKET || "product-images";
    const filename = `${Date.now()}-${data.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}.webp`;
    const path = `products/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, optimized, {
        contentType: "image/webp",
        upsert: false,
      });

    if (uploadError) {
      logger.error(`Supabase upload error: ${uploadError.message}`);
      return res
        .status(500)
        .send({ error: `Image upload failed: ${uploadError.message}` });
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    logger.info(`Image uploaded: ${publicUrl}`);
    return res.send({ ok: true, url: publicUrl });
  } catch (error: any) {
    logger.error(`Error in uploadProductImage: ${error.message}`);
    return res.status(500).send({ error: NODE_ENV === "development" ? error.message : "Internal Server Error" });
  }
};

// ─── DELETE /upload-image ────────────────────────────────────────────────────
// Admin: Remove an old image from Supabase Storage by its public URL
export const deleteProductImage = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { url } = req.body as any;
    if (!url || typeof url !== "string") {
      return res.status(400).send({ error: "url is required" });
    }

    const supabase = getSupabaseAdmin();
    const bucket = SUPABASE_STORAGE_BUCKET || "product-images";

    const marker = `/object/public/${bucket}/`;
    const markerIdx = url.indexOf(marker);
    if (markerIdx === -1) {
      return res
        .status(400)
        .send({
          error: "URL does not appear to be a Supabase storage URL for this bucket",
        });
    }
    const storagePath = url.slice(markerIdx + marker.length);

    const { error: deleteError } = await supabase.storage
      .from(bucket)
      .remove([storagePath]);
    if (deleteError) {
      return res.status(500).send({ error: `Delete failed: ${deleteError.message}` });
    }

    return res.send({ ok: true, deleted: storagePath });
  } catch (error: any) {
    logger.error(`Error in deleteProductImage: ${error.message}`);
    return res.status(500).send({ error: NODE_ENV === "development" ? error.message : "Internal Server Error" });
  }
};
