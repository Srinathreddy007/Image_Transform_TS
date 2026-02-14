/**
 * Express error-handling middleware.
 *
 * Catches HttpError instances and sends appropriate JSON responses.
 * Handles Multer file-too-large with a clear 400 message.
 * Handles unexpected errors gracefully.
 */

import { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/HttpError";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // If it's our custom HttpError, use its status code and message.
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ detail: err.message });
    return;
  }

  // Multer: file exceeded size limit (rejected before route runs).
  const multerErr = err as { code?: string };
  if (multerErr?.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ detail: "The image size has to be below 10 MB." });
    return;
  }

  // For unexpected errors, log them and return 500.
  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("Unhandled error:", err);
  res.status(500).json({ detail: message });
}
