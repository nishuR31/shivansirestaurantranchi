import { FastifyRequest, FastifyReply } from "fastify";
import { prismaApp } from "../../core/config/databaseConfig";
import logger from "../../core/config/loggerConfig";
import { fetchWithCache } from "../../core/config/redisConfig";
import { NODE_ENV } from "../../core/config/envConfig";
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
    return res.status(500).send({ error: NODE_ENV === "development" ? error.message : "Internal Server Error" });
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
    return res.status(500).send({ error: NODE_ENV === "development" ? error.message : "Internal Server Error" });
  }
};

export const deleteReview = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { id } = req.params as any;
    await prismaApp.review.delete({ where: { id } });
    return res.send({ ok: true, deleted: id });
  } catch (error: any) {
    logger.error(`Error in deleteReview: ${error.message}`);
    return res.status(500).send({ error: NODE_ENV === "development" ? error.message : "Internal Server Error" });
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
    return res.status(500).send({ error: NODE_ENV === "development" ? error.message : "Internal Server Error" });
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
    return res.status(500).send({ error: NODE_ENV === "development" ? error.message : "Internal Server Error" });
  }
};


