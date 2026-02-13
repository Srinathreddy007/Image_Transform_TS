/**
 * Service: Image Processing  (sharp)
 *
 * Pure image manipulation — no network calls, no side effects.
 * Currently performs transforms (horizontal flip, compression),
 * but the module is structured so additional transforms can be added easily.
 */

import sharp from "sharp";

/**
 * Flip an image along the vertical axis (mirror it horizontally).
 *
 * @param imageBuffer - Raw PNG / image bytes.
 * @returns PNG Buffer of the flipped image.
 * @throws Error if the bytes cannot be decoded as an image.
 */
export async function flipHorizontal(imageBuffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(imageBuffer).flop().png().toBuffer();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot decode image: ${message}`);
  }
}

/**
 * Optimize and compress an image for faster loading.
 * Resizes large images to max 1920px width/height and compresses PNG.
 *
 * @param imageBuffer - Raw PNG / image bytes.
 * @returns Optimized PNG Buffer.
 * @throws Error if the bytes cannot be decoded as an image.
 */
export async function optimizeImage(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    // Resize if image is larger than 1920px on either dimension
    const maxDimension = 1920;
    let processed = image;
    
    if (metadata.width && metadata.height) {
      if (metadata.width > maxDimension || metadata.height > maxDimension) {
        processed = processed.resize(maxDimension, maxDimension, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }
    }
    
    // Compress PNG with quality optimization
    return await processed
      .png({ 
        quality: 85,
        compressionLevel: 9,
        adaptiveFiltering: true,
      })
      .toBuffer();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot optimize image: ${message}`);
  }
}
