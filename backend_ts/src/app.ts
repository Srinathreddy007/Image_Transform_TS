/**
 * Application factory — creates and configures the Express instance.
 *
 * Responsibilities:
 *   1. Mount CORS middleware (so the React dev server can call us)
 *   2. Register the image router at /api/images
 *   3. Provide a health-check endpoint at GET /api/health
 *   4. In production, serve the built React frontend as static files
 */

import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import multer from "multer";
import { settings } from "./config";
import imagesRouter from "./routes/images";
import { errorHandler } from "./middleware/errorHandler";

// Path to the built frontend (copied here by the deploy script).
const STATIC_DIR = path.resolve(__dirname, "..", "static");

/**
 * Build and return the configured Express application.
 */
export function createApp(): express.Express {
  const app = express();

  // CORS 
  // In production the frontend is served from the same origin,
  // so CORS is not strictly needed — but we keep it as a safety net.
  app.use(
    cors({
      origin: settings.CORS_ORIGINS,
      credentials: true,
    })
  );

  //  Body parsing 
  app.use(express.json());

  //  File upload middleware (multer - memory storage)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: settings.MAX_FILE_SIZE_MB * 1024 * 1024 },
  });

  // API routers 
  app.use("/api/images", upload.single("file"), imagesRouter);

  //  Health check 
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  //Serve React frontend (production only)
  if (fs.existsSync(STATIC_DIR)) {
    const assetsDir = path.join(STATIC_DIR, "assets");
    // Serve JS/CSS from /assets — only if file exists; otherwise 404 (never HTML)
    app.use("/assets", (req: Request, res: Response) => {
      const name = path.basename(req.path);
      if (!name) {
        res.status(404).end();
        return;
      }
      const filePath = path.join(assetsDir, name);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.sendFile(filePath);
      } else {
        res.status(404).end();
      }
    });

    // Serve favicon
    app.get("/favicon.svg", (_req: Request, res: Response) => {
      res.sendFile(path.join(STATIC_DIR, "favicon.svg"));
    });

    // SPA fallback: serve index.html for non-API, non-asset routes (with no-cache so deploy updates apply)
    app.use((req: Request, res: Response, next) => {
      if (req.path.startsWith("/api")) {
        return next();
      }
      if (req.path.startsWith("/assets/")) {
        return res.status(404).end();
      }
      const filePath = path.join(STATIC_DIR, req.path);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.sendFile(filePath);
      } else {
        // Prevent caching so users always get latest index.html (and correct asset hashes) after deploy
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.sendFile(path.join(STATIC_DIR, "index.html"));
      }
    });
  }

  // Error handling middleware 
  app.use(errorHandler);

  return app;
}
