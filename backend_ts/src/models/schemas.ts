/**
 * TypeScript interfaces that define the shape of every API response.
 *
 * Using explicit interfaces instead of raw objects gives us:
 *   - Compile time type safety across the codebase
 *   - Self documenting API contracts
 *   - Consistent response shapes
 */

// Single image 
/** Returned after a successful upload or when fetching a single image. */
export interface ImageResponse {
  /** Unique identifier */
  id: string;
  /** Name of the file the user uploaded */
  original_filename: string;
  /** Public URL of the processed image */
  url: string;
  /** ISO 8601 timestamp of creation */
  created_at: string;
}

// Image list 
/** Wraps a list of images for the GET /api/images endpoint. */
export interface ImageListResponse {
  count: number;
  images: ImageResponse[];
}

// Deletion 
/** Returned after a successful deletion. */
export interface DeleteResponse {
  detail: string;
  id: string;
}

//  Errors 

/** Standard error envelope used across all error responses. */
export interface ErrorResponse {
  detail: string;
}
