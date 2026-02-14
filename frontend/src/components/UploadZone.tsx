import { useCallback, useRef, useState } from 'react'
import { uploadImage } from '../api'
import type { ImageMeta } from '../types'

/* ── Allowed types & max size ─────────────────────────────────────────────── */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_MB = 10

/* ── Processing steps shown to the user while the backend works ──────────── */
const STEPS = [
  'Removing background…',
  'Flipping horizontally…',
  'Uploading to cloud…',
]

/** Human-readable file size */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  onUpload: (image: ImageMeta) => void
  onError: (msg: string) => void
}

export default function UploadZone({ onUpload, onError }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  /* ── Validate & send ──────────────────────────────────────────────────── */
  const handleFile = useCallback(
    async (file: File) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        onError('Only PNG, JPEG, and WebP images are allowed.')
        return
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        onError(`File is too large. Maximum size is ${MAX_MB} MB.`)
        return
      }

      setBusy(true)
      setStepIdx(0)
      setFileName(file.name)
      setFileSize(file.size)

      // Cycle through step labels while the backend processes
      const interval = setInterval(() => {
        setStepIdx((prev) => Math.min(prev + 1, STEPS.length - 1))
      }, 900)

      try {
        const result = await uploadImage(file)
        onUpload(result)
      } catch (err: unknown) {
        onError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        clearInterval(interval)
        setBusy(false)
        setStepIdx(0)
        setFileName('')
      }
    },
    [onUpload, onError],
  )

  /* ── Drag-and-drop handlers ───────────────────────────────────────────── */
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const onDragLeave = useCallback(() => setDragOver(false), [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (busy) return
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile, busy],
  )

  /* ── Click & keyboard support ─────────────────────────────────────────── */
  const openPicker = useCallback(() => {
    if (!busy) inputRef.current?.click()
  }, [busy])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openPicker()
      }
    },
    [openPicker],
  )

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file && !busy) handleFile(file)
      e.target.value = ''
    },
    [handleFile, busy],
  )

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div
      className={`upload-zone${dragOver ? ' drag-over' : ''}${busy ? ' busy' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={openPicker}
      onKeyDown={onKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Upload an image"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        hidden
        onChange={onFileChange}
      />

      {busy ? (
        <div className="upload-progress">
          <div className="spinner" />
          <p className="step-label">{STEPS[stepIdx]}</p>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          {/* Show which file is being processed */}
          <p className="file-meta">
            {fileName} <span className="file-size">({formatSize(fileSize)})</span>
          </p>
        </div>
      ) : (
        <div className="upload-prompt">
          <svg
            className="upload-icon"
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="upload-text">Click or drag an image here to process it</p>
          <p className="upload-hint">PNG, JPEG, or WebP up to 10 MB</p>
        </div>
      )}
    </div>
  )
}
