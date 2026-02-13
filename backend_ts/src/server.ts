/**
 * Entry point — start the Express server.
 *
 * Usage:
 *   npm run dev      (development with hot-reload)
 *   npm run build    (compile TypeScript)
 *   npm start        (production)
 */

import { loadSecretsIntoEnv } from "./config";

// Load secrets from Secret Manager in production before importing anything else.
(async () => {
  try {
    await loadSecretsIntoEnv(["REMOVE_BG_API_KEY", "IMGBB_API_KEY"]);
  } catch (err) {
    console.error("Failed to load secrets:", err);
    process.exit(1);
  }

  const { createApp } = await import("./app");
  const { settings } = await import("./config");

  const app = createApp();

  app.listen(settings.PORT, () => {
    console.log(`
══════════════════════════════════════════════════════════
  Image Transformation Service (TypeScript)
  Running on http://localhost:${settings.PORT}
  Environment: ${settings.ENVIRONMENT}
══════════════════════════════════════════════════════════
    `);
  });
})();
