import type { FastifyRequest, FastifyReply } from "fastify";
import optimizeImage from "../utils/helpers/imageUpload";
import uploadToService from "../utils/image";

// ─── Constants ───────────────────────────────────────────────────────────────

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Smart-coerce a multipart text-field string to its real JS type.
 */
function coerceField(raw: string): unknown {
  if (raw === "") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface ImageUploadMiddlewareOptions {
  /** Max output width in px (default: 1200) */
  maxWidth?: number;
  /** Max output height in px (default: 1200) */
  maxHeight?: number;
  /** WebP quality 1–100 (default: 82) */
  quality?: number;
  /** Prefix for the filename sent to imgbb (default: "upload") */
  namePrefix?: string;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Returns a Fastify preHandler async function.
 * Attach it to any route that may receive an "image" file field.
 */
export function createImageUploadMiddleware(opts: ImageUploadMiddlewareOptions = {}) {
  const { maxWidth = 1200, maxHeight = 1200, quality = 82, namePrefix = "upload" } = opts;

  return async function imageUploadMiddleware(
    req: FastifyRequest,
    res: FastifyReply,
  ): Promise<void> {
    // ── 1. Only act on multipart requests ──────────────────────────────────
    if (!req.isMultipart()) return;

    const textFields: Record<string, unknown> = {};
    let imageUrl: string | undefined;

    // ── 2. Stream all multipart parts ──────────────────────────────────────
    try {
      const parts = req.parts({ limits: { fileSize: MAX_FILE_SIZE } });

      for await (const part of parts) {
        if (part.type === "file") {
          // We only process the field named "image"; drain others to prevent leaks
          if (part.fieldname !== "image") {
            await part.toBuffer();
            continue;
          }

          // Validate MIME type
          if (!ALLOWED_MIME.has(part.mimetype)) {
            await part.toBuffer(); // drain the stream
            res.status(400).send({
              success: false,
              message: `Unsupported image type "${part.mimetype}". Allowed: ${[...ALLOWED_MIME].join(", ")}`,
            });
            return;
          }

          const rawBuffer = await part.toBuffer();

          if (rawBuffer.length === 0) {
            res
              .status(400)
              .send({ success: false, message: "Uploaded image file is empty" });
            return;
          }

          // ── 3. Optimise with sharp → WebP ─────────────────────────────
          const { buffer: optimised } = await optimizeImage(rawBuffer, maxWidth, maxHeight, quality);

          // Build a clean filename for imgbb
          const baseName = (part.filename ?? "image")
            .replace(/\.[^.]+$/, "") // strip extension
            .replace(/[^a-zA-Z0-9_-]/g, "_") // sanitise
            .slice(0, 50);
          const filename = `${namePrefix}_${baseName}_${Date.now()}.webp`;

          // ── 4. Upload to imgbb ────────────────────────────────────────
          const result = await uploadToService("supabase", optimised, filename);

          imageUrl = result.url;
        } else {
          // Text field — smart-coerce and collect
          textFields[part.fieldname] = coerceField(part.value as string);
        }
      }
    } catch (err: any) {
      // @fastify/multipart emits this code when the file exceeds the limit
      if (err?.code === "FST_REQ_FILE_TOO_LARGE" || err?.statusCode === 413) {
        res.status(413).send({
          success: false,
          message: `File too large. Maximum allowed size is ${MAX_FILE_SIZE / 1024 / 1024} MB`,
        });
        return;
      }
      throw err; // let Fastify's global error handler deal with it
    }

    // ── 5. Reconstruct req.body ─────────────────────────────────────────────
    (req as any).body = {
      ...textFields,
      ...(imageUrl !== undefined ? { imageUrl } : {}),
    };
  };
}

// ─── Pre-configured instances ────────────────────────────────────────────────

/** For product create / update (1200×1200, 82% quality) */
export const productImageMiddleware = createImageUploadMiddleware({
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 82,
  namePrefix: "product",
});

/** For category create / update (800×800, 80% quality) */
export const categoryImageMiddleware = createImageUploadMiddleware({
  maxWidth: 800,
  maxHeight: 800,
  quality: 80,
  namePrefix: "category",
});

/** For user profile avatar (400×400, 85% quality) */
export const avatarImageMiddleware = createImageUploadMiddleware({
  maxWidth: 400,
  maxHeight: 400,
  quality: 85,
  namePrefix: "avatar",
});
