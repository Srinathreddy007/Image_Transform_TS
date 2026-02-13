import type { ImageMeta } from '../types'
import ImageCard from './ImageCard'

interface Props {
  images: ImageMeta[]
  onDeleted: (id: string) => void
  onError: (msg: string) => void
  newlyUploadedIds?: Set<string> // Set of image IDs that were just uploaded
}

export default function ImageGallery({ images, onDeleted, onError, newlyUploadedIds = new Set() }: Props) {
  if (images.length === 0) {
    return (
      <div className="empty-state">
        {/* Empty gallery icon */}
        <svg
          className="empty-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="56"
          height="56"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <p>No processed images yet.<br />Upload one above to get started.</p>
      </div>
    )
  }

  return (
    <div className="gallery-grid">
      {images.map((img) => (
        <ImageCard
          key={img.id}
          image={img}
          onDeleted={onDeleted}
          onError={onError}
          isNewlyUploaded={newlyUploadedIds.has(img.id)}
        />
      ))}
    </div>
  )
}
