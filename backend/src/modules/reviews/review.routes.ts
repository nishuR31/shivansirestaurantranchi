import { FastifyInstance } from "fastify";
import * as reviewController from "./review.controller";
import { authenticate } from "../../core/middlewares/authMiddleware";
import { requireAdmin } from "../../core/middlewares/requireRole";

export default async function reviewRoutes(app: FastifyInstance) {
  app.get("/", reviewController.getReviews);
  app.get("/google", reviewController.getGoogleRatings);
  app.get("/admin", { preHandler: [authenticate as any, requireAdmin as any] }, reviewController.getAdminReviews);
  
  app.patch(
    "/:id/publish",
    { preHandler: [authenticate as any, requireAdmin as any] },
    reviewController.updateReviewPublished
  );

  app.delete(
    "/:id",
    { preHandler: [authenticate as any, requireAdmin as any] },
    reviewController.deleteReview
  );
}
