import { FastifyRequest, FastifyReply } from "fastify";
import { prismaApp } from "../../core/config/databaseConfig";
import logger from "../../core/config/loggerConfig";
import { fetchWithCache } from "../../core/config/redisConfig";

export const getReviews = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { limit } = (req.query as any) ?? {};
    const take = Math.min(Number(limit) || 6, 50);
    const cacheKey = `data:reviews:genuine:limit=${take}`;
    const reviews = await fetchWithCache(cacheKey, 30, () =>
      prismaApp.review.findMany({
        orderBy: { created_at: "desc" },
        take,
      }),
    );
    return res.send(reviews);
  } catch (error: any) {
    logger.error(`Error in getReviews: ${error.message}`);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};

export const getAdminReviews = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { limit } = (req.query as any) ?? {};
    const take = Math.min(Number(limit) || 50, 200);
    const cacheKey = `data:reviews:all=true:limit=${take}`;
    const reviews = await fetchWithCache(cacheKey, 30, () =>
      prismaApp.review.findMany({
        orderBy: { created_at: "desc" },
        take,
      }),
    );
    return res.send(reviews);
  } catch (error: any) {
    logger.error(`Error in getAdminReviews: ${error.message}`);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};

export const deleteReview = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { id } = req.params as any;
    await prismaApp.review.delete({ where: { id } });
    return res.send({ ok: true, deleted: id });
  } catch (error: any) {
    logger.error(`Error in deleteReview: ${error.message}`);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};

export const getGoogleRatings = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const placeId = process.env.GOOGLE_PLACE_ID;
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!placeId || !apiKey) {
      return res.send({ error: "Google API credentials not configured" });
    }

    const data = await fetchWithCache("data:google_ratings", 3600, async () => {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=rating,user_ratings_total,reviews&key=${apiKey}`,
      );
      if (!response.ok) throw new Error("Failed to fetch Google Places data");
      const result = (await response.json()) as any;

      if (result.status !== "OK")
        throw new Error(result.error_message || "Google API error");

      return {
        rating: result.result.rating,
        total_ratings: result.result.user_ratings_total,
        reviews: (result.result.reviews || []).slice(0, 3).map((r: any) => ({
          author_name: r.author_name,
          rating: r.rating,
          text: r.text,
          time: r.time,
        })),
      };
    });

    return res.send(data);
  } catch (error: any) {
    logger.error(`Error in getGoogleRatings: ${error.message}`);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};

// ─── PATCH /reviews/:id/publish ─────────────────────────────────────────────
// Admin: toggle is_published on a review
export const updateReviewPublished = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { id } = req.params as any;
    const { is_published } = req.body as any;
    if (typeof is_published !== "boolean") {
      return res.status(400).send({ error: "is_published must be a boolean" });
    }
    const review = await prismaApp.review.update({
      where: { id },
      data: { is_published },
    });
    return res.send({ ok: true, review });
  } catch (error: any) {
    logger.error(`Error in updateReviewPublished: ${error.message}`);
    return res.status(500).send({ error: "Internal Server Error" });
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
    return res.status(500).send({ error: error.message || "Internal Server Error" });
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

    // Extract the storage path from the public URL
    // public URL pattern: <SUPABASE_URL>/storage/v1/object/public/<bucket>/<path>
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
    return res.status(500).send({ error: "Internal Server Error" });
  }
};
