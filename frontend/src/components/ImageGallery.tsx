import type { ImageMeta } from '../types'
import ImageCard from './ImageCard'

interface Props {
  images: ImageMeta[]
  total: number
  currentPage: number
  pageSize: number
  onPageChange: (page: number) => void
  onDeleted: (id: string) => void
  onError: (msg: string) => void
  newlyUploadedIds?: Set<string>
}

export default function ImageGallery({
  images,
  total,
  currentPage,
  pageSize,
  onPageChange,
  onDeleted,
  onError,
  newlyUploadedIds = new Set(),
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const effectivePage = Math.min(currentPage, totalPages)
  const startIndex = total === 0 ? 0 : (effectivePage - 1) * pageSize + 1
  const endIndex = total === 0 ? 0 : Math.min(effectivePage * pageSize, total)

  const goPrev = () => onPageChange(Math.max(1, effectivePage - 1))
  const goNext = () => onPageChange(Math.min(totalPages, effectivePage + 1))

  if (total === 0 && images.length === 0) {
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
    <div className="gallery-with-pagination">
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
      {totalPages > 1 && (
        <nav className="gallery-pagination gallery-pagination-bottom" aria-label="Processed images pagination">
          <button
            type="button"
            className="btn btn-pagination"
            onClick={goPrev}
            disabled={effectivePage <= 1}
            aria-label="Previous page"
          >
            Previous
          </button>
          <span className="gallery-pagination-info">
            Page {effectivePage} of {totalPages}
            <span className="gallery-pagination-range">
              ({startIndex}–{endIndex} of {total})
            </span>
          </span>
          <button
            type="button"
            className="btn btn-pagination"
            onClick={goNext}
            disabled={effectivePage >= totalPages}
            aria-label="Next page"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  )
}
