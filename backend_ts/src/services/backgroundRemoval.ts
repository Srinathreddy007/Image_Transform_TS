/**
 * Service: Background Removal  (remove.bg API)
 *
 * Sends raw image bytes to the remove.bg REST API and returns the result.
 * Free usage : 50 API calls / month
 *
 * API docs: https://www.remove.bg/api
 */

import axios from "axios";
import FormData from "form-data";
import { settings } from "../config";

const REMOVE_BG_URL = "https://api.remove.bg/v1.0/removebg";

/**
 * Call the remove.bg API to strip the background from an image.
 *
 * @param imageBuffer - Raw bytes of the uploaded image.
 * @returns PNG Buffer of the image with the background removed.
 * @throws Error if the API call fails for any reason.
 */
export async function removeBackground(imageBuffer: Buffer): Promise<Buffer> {
  const form = new FormData();
  form.append("image_file", imageBuffer, {
    filename: "image.png",
    contentType: "image/png",
  });
  form.append("size", "auto");

  let response;
  try {
    response = await axios.post(REMOVE_BG_URL, form, {
      headers: {
        ...form.getHeaders(),
        "X-Api-Key": settings.REMOVE_BG_API_KEY,
      },
      responseType: "arraybuffer",
      timeout: 60_000,
      // Don't throw on non 2xx so we can handle errors ourselves
      validateStatus: () => true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`remove.bg request failed: ${message}`);
  }

  if (response.status !== 200) {
    let errorDetail: string;
    try {
      const body = JSON.parse(Buffer.from(response.data).toString("utf-8"));
      errorDetail = body?.errors?.[0]?.title ?? JSON.stringify(body);
    } catch {
      errorDetail = Buffer.from(response.data).toString("utf-8");
    }

    // Provide a user friendly message for common failures.
    if (response.status === 400 && errorDetail.toLowerCase().includes("foreground")) {
      throw new Error(
        "Could not detect a clear subject in this image. " +
          "Try uploading a photo with a person, animal, product, or " +
          "other distinct foreground object."
      );
    }

    throw new Error(
      `remove.bg API error (HTTP ${response.status}): ${errorDetail}`
    );
  }

  return Buffer.from(response.data);
}
