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
      `File exceeds the ${settings.MAX_FILE_SIZE_MB} MB size limit.`
    );
  }
}

//  POST /api/images — upload and process 

router.post("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const pipelineStart = performance.now();

  const file = req.file;
  validateUpload(file);

  const contents = file.buffer;

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

  // Step 3 — Upload to ImgBB
  const imageId = uuidv4().replace(/-/g, "").slice(0, 12);
  const t4 = performance.now();
  let cloudResult;
  try {
    cloudResult = await uploadImage(optimized, imageId);
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
    original_filename: file.originalname ?? "unknown",
    url: cloudResult.url,
    created_at: cloudResult.created_at,
  };

  res.status(201).json(response);
});

// GET /api/images — list all 

router.get("/", (_req: Request, res: Response, next: NextFunction): void => {
  try {
    const images = listImages();

    const items: ImageResponse[] = images.map((img) => ({
      id: img.public_id,
      original_filename: "—", // ImgBB doesn't store the original name
      url: img.url,
      created_at: img.created_at,
    }));

    const response: ImageListResponse = {
      count: items.length,
      images: items,
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
