import { useCallback, useEffect, useState } from 'react'
import { deleteImage } from '../api'
import type { ImageMeta } from '../types'

interface Props {
  image: ImageMeta
  onDeleted: (id: string) => void
  onError: (msg: string) => void
  isNewlyUploaded?: boolean // If true, load immediately (no lazy loading)
}

export default function ImageCard({ image, onDeleted, onError, isNewlyUploaded = false }: Props) {
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

  // Preload image immediately if it's newly uploaded
  useEffect(() => {
    if (isNewlyUploaded && image.url) {
      const img = new Image()
      img.src = image.url
      img.onload = () => setImgLoaded(true)
      img.onerror = () => setImgError(true)
    }
  }, [isNewlyUploaded, image.url])

  /* ── Copy the hosted URL to clipboard ─────────────────────────────────── */
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(image.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      onError('Failed to copy URL to clipboard')
    }
  }, [image.url, onError])

  /* ── Delete with two-step confirmation ────────────────────────────────── */
  const handleDelete = useCallback(async () => {
    if (!confirming) {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 3000)
      return
    }

    setDeleting(true)
    try {
      await deleteImage(image.id)
      onDeleted(image.id)
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }, [confirming, image.id, onDeleted, onError])

  const formattedDate = new Date(image.created_at).toLocaleString()

  return (
    <div className="image-card">
      {/* Thumbnail with shimmer loading + error fallback */}
      <a className="image-thumb-wrapper" href={image.url} target="_blank" rel="noopener noreferrer">
        {/* Shimmer placeholder visible while loading */}
        {!imgLoaded && !imgError && <div className="image-shimmer" />}

        {/* Broken image fallback */}
        {imgError && (
          <div className="image-fallback">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="9" x2="15" y2="15" />
              <line x1="15" y1="9" x2="9" y2="15" />
            </svg>
            <span>Could not load image</span>
          </div>
        )}

        {!imgError && (
          <img
            className={`image-thumb${imgLoaded ? ' loaded' : ''}`}
            src={image.url}
            alt={image.original_filename}
            loading={isNewlyUploaded ? "eager" : "lazy"}
            fetchPriority={isNewlyUploaded ? "high" : undefined}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        )}
      </a>

      {/* Info */}
      <div className="image-info">
        <p className="image-name" title={image.original_filename}>
          {image.original_filename}
        </p>
        <p className="image-date">{formattedDate}</p>
      </div>

      {/* Actions */}
      <div className="image-actions">
        <button
          className={`btn btn-copy${copied ? ' copied' : ''}`}
          onClick={handleCopy}
          title="Copy hosted URL"
        >
          {copied ? (
            <>
              <svg className="btn-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            'Copy URL'
          )}
        </button>

        <button
          className={`btn btn-delete${confirming ? ' confirming' : ''}`}
          onClick={handleDelete}
          disabled={deleting}
          title={confirming ? 'Click again to confirm' : 'Delete image'}
        >
          {deleting ? 'Deleting…' : confirming ? 'Confirm?' : 'Delete'}
        </button>
      </div>
    </div>
  )
}
