/**
 * Service: Cloud Storage  (ImgBB)
 *
 * Handles uploading, listing, and deleting images via ImgBB.
 * Each uploaded image gets a permanent public URL.
 *
 * ImgBB has no "list" or "delete-by-id" API, so we keep a lightweight
 * local JSON registry that maps image IDs to their metadata and delete URLs.
 *
 * Free usage - no strict rate limit.  https://api.imgbb.com
 */

import axios from "axios";
import fs from "fs";
import path from "path";
import { settings } from "../config";

const IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload";

// Registry path 
// On App Engine the filesystem is read only except /tmp, so we use /tmp there.
const REGISTRY_PATH = settings.isProduction
  ? path.join("/tmp", "uploads", "registry.json")
  : path.join(__dirname, "..", "..", "uploads", "registry.json");

// Ensure the directory exists.
fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });

//  Registry record type 

interface RegistryRecord {
  public_id: string;
  url: string;
  delete_url: string;
  created_at: string;
  original_filename: string; // Store original filename for better UX
}

type Registry = Record<string, RegistryRecord>;

//  Registry helpers 
/** Read the JSON registry from disk. Returns an empty object if missing. */
function loadRegistry(): Registry {
  if (!fs.existsSync(REGISTRY_PATH)) return {};
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, "utf-8");
    return JSON.parse(raw) as Registry;
  } catch {
    return {};
  }
}

/** Write the registry object to disk as formatted JSON. */
function saveRegistry(registry: Registry): void {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), "utf-8");
}

// Public API 
export interface CloudUploadResult {
  public_id: string;
  url: string;
  delete_url: string;
  created_at: string;
  original_filename: string;
}

/**
 * Upload processed image bytes to ImgBB.
 *
 * @param imageBuffer - Raw PNG bytes to upload.
 * @param publicId    - Unique identifier for this image.
 * @param originalFilename - Original filename from user upload (for storage).
 * @returns Object with: public_id, url, delete_url, created_at, original_filename.
 * @throws Error if the upload fails.
 */
export async function uploadImage(
  imageBuffer: Buffer,
  publicId: string,
  originalFilename?: string
): Promise<CloudUploadResult> {
  const b64Image = imageBuffer.toString("base64");

  let response;
  try {
    response = await axios.post(
      IMGBB_UPLOAD_URL,
      new URLSearchParams({
        key: settings.IMGBB_API_KEY,
        image: b64Image,
        name: publicId,
      }),
      { timeout: 60_000, validateStatus: () => true }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`ImgBB request failed: ${message}`);
  }

  if (response.status !== 200) {
    let detail: string;
    try {
      detail = response.data?.error?.message ?? JSON.stringify(response.data);
    } catch {
      detail = String(response.data);
    }
    throw new Error(`ImgBB upload failed (HTTP ${response.status}): ${detail}`);
  }

  const data = response.data?.data ?? {};

  const record: RegistryRecord = {
    public_id: publicId,
    url: data.display_url ?? data.url ?? "",
    delete_url: data.delete_url ?? "",
    created_at: new Date().toISOString(),
    original_filename: originalFilename ?? "image.png",
  };

  // Persist to local registry so we can list / delete later.
  const registry = loadRegistry();
  registry[publicId] = record;
  saveRegistry(registry);

  return record;
}

/**
 * List all images from the local registry.
 *
 * @returns Array of objects, each with: public_id, url, created_at, original_filename.
 */
export function listImages(): Array<{
  public_id: string;
  url: string;
  created_at: string;
  original_filename: string;
}> {
  const registry = loadRegistry();
  return Object.values(registry).map((rec) => ({
    public_id: rec.public_id,
    url: rec.url,
    created_at: rec.created_at,
    original_filename: rec.original_filename ?? "—", // Fallback for old records
  }));
}

/**
 * Delete an image by hitting the delete URL that ImgBB returned on upload.
 * If the same image was uploaded twice (ImgBB may return the same URL/delete_url
 * for identical content), we only call the delete URL when this is the last
 * registry entry sharing that delete_url, so deleting one entry does not break
 * the other.
 *
 * @returns true if the image was found and removed from registry (and from
 *   ImgBB when it was the last reference).
 * @throws Error if the HTTP request itself errors out.
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  const registry = loadRegistry();
  const record = registry[publicId];

  if (!record) return false;

  const deleteUrl = record.delete_url;

  // Remove our registry entry first so we count references excluding this one.
  delete registry[publicId];
  saveRegistry(registry);

  // Only call ImgBB delete if no other registry entry shares this delete_url.
  // (Same image uploaded twice can yield the same ImgBB URL/delete_url.)
  if (deleteUrl) {
    const othersWithSameDeleteUrl = Object.values(registry).filter(
      (r) => r.delete_url === deleteUrl
    );
    if (othersWithSameDeleteUrl.length === 0) {
      try {
        await axios.get(deleteUrl, { timeout: 30_000 });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`ImgBB delete request failed: ${message}`);
      }
    }
  }

  return true;
}
