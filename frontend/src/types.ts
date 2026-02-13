/** Matches backend ImageResponse schema */
export interface ImageMeta {
  id: string
  original_filename: string
  url: string
  created_at: string
}

/** Matches backend ImageListResponse schema (with pagination) */
export interface ImageListResponse {
  count: number
  total: number
  images: ImageMeta[]
}

/** Matches backend ErrorResponse schema */
export interface ErrorResponse {
  detail: string
}
