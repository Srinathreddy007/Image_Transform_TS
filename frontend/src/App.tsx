import { useCallback, useEffect, useState } from 'react'
import { listImages } from './api'
import UploadZone from './components/UploadZone'
import ImageGallery from './components/ImageGallery'
import type { ImageMeta } from './types'
import './index.css'

/* ── Toast helpers ──────────────────────────────────────────────────────── */
interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

let nextToastId = 0

const PAGE_SIZE = 6

export default function App() {
  const [images, setImages] = useState<ImageMeta[]>([])
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [newlyUploadedIds, setNewlyUploadedIds] = useState<Set<string>>(new Set())

  /* ── Show a toast notification ────────────────────────────────────────── */
  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = nextToastId++
    setToasts((prev) => [...prev, { id, message, type }])
    const delay = type === 'error' ? 6000 : 4000
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, delay)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  /* ── Load one page of images (backend pagination, latest first) ────────── */
  useEffect(() => {
    setLoading(true)
    listImages(currentPage, PAGE_SIZE)
      .then(({ images: list, total: t }) => {
        setImages(list)
        setTotal(t)
      })
      .catch(() => addToast('Could not load images from server.', 'error'))
      .finally(() => setLoading(false))
  }, [currentPage, addToast])

  /* ── Handlers ─────────────────────────────────────────────────────────── */
  const handleUpload = useCallback(
    (image: ImageMeta) => {
      setNewlyUploadedIds((prev) => new Set([...prev, image.id]))
      setTimeout(() => {
        setNewlyUploadedIds((prev) => {
          const next = new Set(prev)
          next.delete(image.id)
          return next
        })
      }, 5000)
      setTotal((t) => t + 1)
      setCurrentPage(1)
      setImages((prev) => [image, ...prev].slice(0, PAGE_SIZE))
      addToast('Image processed and hosted successfully!', 'success')
      listImages(1, PAGE_SIZE).then(({ images: list, total: t }) => {
        setImages(list)
        setTotal(t)
      }).catch(() => {})
    },
    [addToast],
  )

  const handleDeleted = useCallback(
    (id: string) => {
      setImages((prev) => prev.filter((img) => img.id !== id))
      setTotal((t) => Math.max(0, t - 1))
      addToast('Image deleted.', 'success')
      listImages(currentPage, PAGE_SIZE).then(({ images: list, total: t }) => {
        setImages(list)
        setTotal(t)
        if (list.length === 0 && currentPage > 1) setCurrentPage(1)
      }).catch(() => {})
    },
    [addToast, currentPage],
  )

  const handleError = useCallback(
    (msg: string) => addToast(msg, 'error'),
    [addToast],
  )

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Image Transformation Service</h1>
        <p className="app-subtitle">
          Upload an image, remove its background, flip it, and get a hosted URL
        </p>
        <div className="pipeline" role="presentation">
          <div className="pipeline-step">
            <div className="pipeline-step-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <span className="pipeline-step-label">Upload</span>
          </div>
          <div className="pipeline-arrow" aria-hidden="true">&gt;</div>
          <div className="pipeline-step">
            <div className="pipeline-step-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
                <path d="M3 9h18" />
              </svg>
            </div>
            <span className="pipeline-step-label">Process</span>
          </div>
          <div className="pipeline-arrow" aria-hidden="true">&gt;</div>
          <div className="pipeline-step">
            <div className="pipeline-step-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <span className="pipeline-step-label">Get URL</span>
          </div>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="app-main">
        <UploadZone onUpload={handleUpload} onError={handleError} />

        {/* Gallery */}
        <section className="gallery-section">
          <h2 className="section-title">
            Processed Images{' '}
            {total > 0 && (
              <span className="badge">{total}</span>
            )}
          </h2>

          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading images…</p>
            </div>
          ) : (
            <ImageGallery
              images={images}
              total={total}
              currentPage={currentPage}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
              onDeleted={handleDeleted}
              onError={handleError}
              newlyUploadedIds={newlyUploadedIds}
            />
          )}
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="app-footer">
        <p>
          Background removal by{' '}
          <a href="https://www.remove.bg" target="_blank" rel="noopener noreferrer">
            remove.bg
          </a>{' '}
          &middot; Hosted on{' '}
          <a href="https://imgbb.com" target="_blank" rel="noopener noreferrer">
            ImgBB
          </a>
        </p>
      </footer>

      {/* ── Toast container ───────────────────────────────────────────── */}
      {toasts.length > 0 && (
        <div className="toast-container" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <span className="toast-icon" aria-hidden="true">
                {t.type === 'success' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                )}
              </span>
              <span className="toast-msg">{t.message}</span>
              <button
                className="toast-dismiss"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss notification"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
