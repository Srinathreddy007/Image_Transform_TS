/**
 * Routes: /api/images
 *
 * Endpoint summary:
 *   POST   /api/images          Upload → remove bg → flip → host → return URL
 *   GET    /api/images          List all processed images
 *   DELETE /api/images/:id      Delete an image from cloud storage
 */

import { Router, Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import sharp from "sharp";
import { settings } from "../config";
import { removeBackground } from "../services/backgroundRemoval";
import { flipHorizontal, optimizeImage } from "../services/imageProcessing";
import { uploadImage, listImages, deleteImage } from "../services/cloudStorage";
import { HttpError } from "../utils/HttpError";
import type {
  ImageResponse,
  ImageListResponse,
  DeleteResponse,
} from "../models/schemas";

const router = Router();

//  Helper to validate the uploaded file 

function validateUpload(
  file: Express.Multer.File | undefined
): asserts file is Express.Multer.File {
  if (!file) {
    throw new HttpError(400, "No file uploaded.");
  }

  if (!file.originalname) {
    throw new HttpError(400, "Filename is missing.");
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (!settings.ALLOWED_EXTENSIONS.has(ext)) {
    const allowed = [...settings.ALLOWED_EXTENSIONS].sort().join(", ");
    throw new HttpError(
      400,
      `Unsupported file type '${ext}'. Allowed types: ${allowed}`
    );
  }

  const maxBytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new HttpError(
      400,
      "The image size has to be below 10 MB."
    );
  }
}

/** Allowed MIME types (must match ALLOWED_EXTENSIONS). */
const ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Detect MIME from magic bytes (PNG, JPEG, WebP). Returns null if unknown. */
function detectMime(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  const b = buffer;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

/** User-facing message when image resolution is below remove.bg–supported minimum. */
const MIN_RESOLUTION_MESSAGE =
  "Only images with resolution of at least 0.25 megapixels (e.g. 500×500) are supported. Images below that resolution are not supported.";

/** User-facing message when image resolution exceeds remove.bg–supported maximum. */
const MAX_RESOLUTION_MESSAGE =
  "Image resolution must be at most 50 megapixels (e.g. 8000x6250). Images above that resolution are not supported.";

//  POST /api/images — upload and process 

router.post("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const pipelineStart = performance.now();

  const file = req.file;
  validateUpload(file);

  const contents = file.buffer;

  // MIME validation (magic bytes) — reject mislabeled or non-image content
  const detectedMime = detectMime(contents);
  if (!detectedMime || !ALLOWED_MIMES.has(detectedMime)) {
    throw new HttpError(400, "Invalid or unsupported image format. Only PNG, JPG, JPEG, and WebP are allowed.");
  }

  // Resolution check for remove.bg: reject very small images
  let width: number, height: number;
  try {
    const meta = await sharp(contents).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } catch {
    throw new HttpError(400, "Invalid or corrupted image; could not read dimensions.");
  }
  const pixels = width * height;
  if (pixels < settings.MIN_IMAGE_PIXELS) {
    throw new HttpError(400, MIN_RESOLUTION_MESSAGE);
  }
  if (pixels > settings.MAX_IMAGE_PIXELS) {
    throw new HttpError(400, MAX_RESOLUTION_MESSAGE);
  }

  // Step 1 — Background removal using remove.bg third-party API
  const t0 = performance.now();
  let bgRemoved: Buffer;
  try {
    bgRemoved = await removeBackground(contents);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    next(new HttpError(502, message));
    return;
  }
  const t1 = performance.now();
  console.log(`Step 1 — Background removal: ${((t1 - t0) / 1000).toFixed(2)}s`);

  // Step 2 — Horizontal flip (local, sharp)
  const t2 = performance.now();
  let flipped: Buffer;
  try {
    flipped = await flipHorizontal(bgRemoved);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    next(new HttpError(500, message));
    return;
  }
  const t3 = performance.now();
  console.log(`Step 2 — Horizontal flip:     ${((t3 - t2) / 1000).toFixed(2)}s`);

  // Step 2.5 — Optimize image (resize & compress for faster loading)
  const t3_5 = performance.now();
  let optimized: Buffer;
  try {
    optimized = await optimizeImage(flipped);
  } catch (err: unknown) {
    // If optimization fails, use the flipped image as is
    console.warn(`Image optimization failed, using original: ${err instanceof Error ? err.message : String(err)}`);
    optimized = flipped;
  }
  const t3_6 = performance.now();
  console.log(`Step 2.5 — Optimization:       ${((t3_6 - t3_5) / 1000).toFixed(2)}s`);

  // Step 3 — Upload to ImgBB (use local filename from client, not ImgBB's)
  const imageId = uuidv4().replace(/-/g, "").slice(0, 12);
  const originalFilename =
    (req.body?.original_filename as string)?.trim() ||
    file.originalname ||
    "image.png";
  const t4 = performance.now();
  let cloudResult;
  try {
    cloudResult = await uploadImage(optimized, imageId, originalFilename);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    next(new HttpError(502, message));
    return;
  }
  const t5 = performance.now();
  console.log(`Step 3 — ImgBB upload:        ${((t5 - t4) / 1000).toFixed(2)}s`);

  const total = (performance.now() - pipelineStart) / 1000;
  console.log(`Total pipeline:               ${total.toFixed(2)}s`);

  const response: ImageResponse = {
    id: cloudResult.public_id,
    original_filename: cloudResult.original_filename,
    url: cloudResult.url,
    created_at: cloudResult.created_at,
  };

  res.status(201).json(response);
});

// Pagination defaults (match frontend: 6 per page, latest first)
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 100;

// GET /api/images — list with optional pagination (?page=1&limit=6), sorted latest first

router.get("/", (req: Request, res: Response, next: NextFunction): void => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page), 10) || DEFAULT_PAGE);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(String(req.query.limit), 10) || DEFAULT_LIMIT)
    );

    const raw = listImages();

    const items: ImageResponse[] = raw.map((img) => ({
      id: img.public_id,
      original_filename: img.original_filename,
      url: img.url,
      created_at: img.created_at,
    }));

    // Sort by latest first
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = items.length;
    const start = (page - 1) * limit;
    const paginated = items.slice(start, start + limit);

    const response: ImageListResponse = {
      count: paginated.length,
      total,
      images: paginated,
    };

    res.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    next(new HttpError(502, message));
  }
});

// ── DELETE /api/images/:imageId — remove from cloud -────────────────────────

router.delete("/:imageId", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const imageId = req.params.imageId as string;

  try {
    const deleted = await deleteImage(imageId);

    if (!deleted) {
      next(new HttpError(404, "Image not found on cloud storage."));
      return;
    }

    const response: DeleteResponse = {
      detail: "Image deleted successfully.",
      id: imageId,
    };

    res.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    next(new HttpError(502, message));
  }
});

export default router;
