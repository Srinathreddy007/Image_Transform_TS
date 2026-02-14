/**
 * Centralised configuration — loaded once from environment variables.
 *
 * Uses dotenv to read `.env` in development.  Every required key is
 * validated at startup; if one is missing the process exits immediately
 * with a clear message rather than crashing mid-request.
 *
 * In production (App Engine), REMOVE_BG_API_KEY and IMGBB_API_KEY are loaded
 * from Google Cloud Secret Manager and injected into the environment before
 * the settings object is created. In development, they come from .env.
 */

import dotenv from "dotenv";
import path from "path";

// Load .env file (no-op in production where env vars are set externally).
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

//  Secret Manager loader (production only)

export async function loadSecretsIntoEnv(secretNames: string[]): Promise<void> {
  const environment = process.env.ENVIRONMENT ?? "development";
  if (environment !== "production") {
    return;
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT is not set in production.");
  }

  // Dynamic import to avoid requiring the package in development.
  const { SecretManagerServiceClient } = await import("@google-cloud/secret-manager");
  const client = new SecretManagerServiceClient();

  for (const secretId of secretNames) {
    const name = `projects/${projectId}/secrets/${secretId}/versions/latest`;
    const [response] = await client.accessSecretVersion({ name });
    if (response.payload?.data) {
      process.env[secretId] = response.payload.data.toString();
    }
  }
}

// Helper 
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return value;
}

// Settings interface 

export interface Settings {
  /** "development" | "production" */
  ENVIRONMENT: string;

  /** remove.bg API key — 50 free calls / month */
  REMOVE_BG_API_KEY: string;

  /** ImgBB API key — free, no strict rate limit */
  IMGBB_API_KEY: string;

  /**
   * Maximum upload size in megabytes (default 10).
   * Keeps processing time and memory reasonable, aligns with remove.bg and
   * typical photo sizes; configurable via MAX_FILE_SIZE_MB env var.
   */
  MAX_FILE_SIZE_MB: number;

  /**
   * Minimum image size in total pixels (width × height).
   * remove.bg supports input up to 50 MP; very small images give poor results.
   * We use 0.25 MP (250,000 pixels, e.g. 500×500) as minimum; configurable via MIN_IMAGE_PIXELS.
   */
  MIN_IMAGE_PIXELS: number;

  /**
   * Maximum image size in total pixels (width × height).
   * remove.bg accepts input up to 50 megapixels; configurable via MAX_IMAGE_PIXELS.
   */
  MAX_IMAGE_PIXELS: number;

  /** Allowed file extensions (lowercase, with dot) */
  ALLOWED_EXTENSIONS: Set<string>;

  /** Server port */
  PORT: number;

  /** Allowed CORS origins */
  CORS_ORIGINS: string[];

  /** Convenience flag */
  isProduction: boolean;
}

// Build & export singleton

const ENVIRONMENT = process.env.ENVIRONMENT ?? "development";

export const settings: Settings = {
  ENVIRONMENT,
  REMOVE_BG_API_KEY: requireEnv("REMOVE_BG_API_KEY"),
  IMGBB_API_KEY: requireEnv("IMGBB_API_KEY"),
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB ?? "10", 10),
  MIN_IMAGE_PIXELS: parseInt(process.env.MIN_IMAGE_PIXELS ?? "250000", 10), // 0.25 MP
  MAX_IMAGE_PIXELS: parseInt(process.env.MAX_IMAGE_PIXELS ?? "50000000", 10), // 50 MP (remove.bg limit)
  ALLOWED_EXTENSIONS: new Set(
    (process.env.ALLOWED_EXTENSIONS ?? ".png,.jpg,.jpeg,.webp").split(",")
  ),
  PORT: parseInt(process.env.PORT ?? "8000", 10),
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(","),
  isProduction: ENVIRONMENT === "production",
};
