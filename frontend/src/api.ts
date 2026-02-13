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

/**
 * Fetch every processed image from the registry.
 */
export async function listImages(): Promise<ImageMeta[]> {
  const res = await fetch(BASE)

  if (!res.ok) {
    throw new Error('Failed to load images')
  }

  const data: ImageListResponse = await res.json()
  return data.images
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
