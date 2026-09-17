/**
 * imageUpload.ts
 *
 * Buffer → Sharp → WebP
 *
 * Compresses/resizes an image and returns the optimized buffer.
 */

import sharp from "sharp";

export interface OptimizedImageResult {
  buffer: Buffer;
  size: number;
  format: "webp";
}

/**
 * Compress and convert an image to WebP.
 *
 * - Maximum width: 800px
 * - Does not enlarge smaller images
 * - WebP quality: 80
 *
 * @param buffer Raw image buffer
 */
export async function optimizeImage(buffer: Buffer, width = 800, height = 800, quality = 80): Promise<OptimizedImageResult> {
  if (!buffer || buffer.length === 0) {
    throw new Error("Image buffer is empty");
  }

  const optimized = await sharp(buffer)
    .resize(width, height, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality,
    })
    .toBuffer();

  return {
    buffer: optimized,
    size: optimized.length,
    format: "webp",
  };
}

export default optimizeImage;
