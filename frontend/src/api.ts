import type { ImageMeta, ImageListResponse } from './types'

const BASE = '/api/images'

/**
 * Upload a single image for processing.
 * Sends as multipart/form-data (same as the Swagger UI does).
 * Returns the processed image metadata including the hosted URL.
 */
export async function uploadImage(file: File): Promise<ImageMeta> {
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(BASE, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Upload failed')
  }

  return res.json()
}

const DEFAULT_PAGE_SIZE = 6

/**
 * Fetch processed images with pagination (latest first).
 * @param page 1-based page number (default 1)
 * @param limit items per page (default 6)
 */
export async function listImages(
  page: number = 1,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<{ images: ImageMeta[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  const res = await fetch(`${BASE}?${params}`)

  if (!res.ok) {
    throw new Error('Failed to load images')
  }

  const data: ImageListResponse = await res.json()
  return { images: data.images, total: data.total }
}

/**
 * Delete a processed image by its unique ID.
 */
export async function deleteImage(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Delete failed')
  }
}
