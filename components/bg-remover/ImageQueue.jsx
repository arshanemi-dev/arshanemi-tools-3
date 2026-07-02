'use client'

import { X, Download, Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react'

function CheckerboardBg() {
  return (
    <div className="absolute inset-0" style={{
      backgroundImage: 'repeating-conic-gradient(#b0b0b0 0% 25%, #ffffff 0% 50%)',
      backgroundSize: '16px 16px',
    }} />
  )
}

function StatusBadge({ status, message }) {
  if (status === 'pending') return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
      style={{ backgroundColor: 'var(--lt-card)', color: 'var(--lt-text-subtle)' }}>
      <Clock size={9} />Pending
    </span>
  )
  if (status === 'processing') return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
      style={{ backgroundColor: 'rgba(59,104,249,0.18)', color: '#3b68f9' }}>
      <Loader2 size={9} className="animate-spin" />
      {message?.includes('Queued') ? 'Queued…' : 'Processing…'}
    </span>
  )
  if (status === 'done') return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
      style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
      <CheckCircle2 size={9} />Done
    </span>
  )
  if (status === 'error') return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
      style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
      <AlertCircle size={9} />Error
    </span>
  )
  return null
}

export default function ImageQueue({ images, onRemove, onDownload }) {
  if (!images.length) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
      <div className="w-24 h-24 rounded-2xl flex items-center justify-center"
        style={{ border: '2px dashed var(--lt-divider-light)', backgroundColor: 'var(--lt-card)' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--lt-divider-light)" strokeWidth="1.5">
          <rect x="2" y="2" width="9" height="9" rx="1.5" />
          <rect x="13" y="2" width="9" height="9" rx="1.5" />
          <rect x="2" y="13" width="9" height="9" rx="1.5" />
          <rect x="13" y="13" width="9" height="9" rx="1.5" />
        </svg>
      </div>
      <p className="text-sm text-center" style={{ color: 'var(--lt-text-subtle)' }}>
        Upload images to get started.
        <br />Supports multiple files at once.
      </p>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        {images.map(img => (
          <div key={img.id}
            className="relative rounded-[12px] overflow-hidden"
            style={{ border: '1px solid var(--lt-divider)', backgroundColor: 'var(--lt-card)' }}>

            {/* Image preview */}
            <div className="relative overflow-hidden" style={{ aspectRatio: '1/1' }}>
              {img.processedUrl && <CheckerboardBg />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.processedUrl || img.originalUrl}
                alt={img.name}
                className="relative w-full h-full object-contain"
              />

              {img.status === 'processing' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                  style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                  <Loader2 size={22} className="animate-spin text-white" />
                  <p className="text-[10px] text-white font-semibold px-2 text-center leading-tight">
                    {img.progress || 'Processing…'}
                  </p>
                </div>
              )}

              {img.status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2"
                  style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
                  <AlertCircle size={20} className="text-red-400" />
                  <p className="text-[9px] text-red-300 text-center leading-tight">{img.error || 'Failed'}</p>
                </div>
              )}

              {/* Top-right remove button (always visible on hover) */}
              <button
                onClick={() => onRemove(img.id)}
                className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:!opacity-100 transition-opacity"
                style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff' }}
                title="Remove">
                <X size={11} />
              </button>
            </div>

            {/* Footer */}
            <div className="px-2 py-2 flex items-center gap-1.5"
              style={{ borderTop: '1px solid var(--lt-divider)' }}>
              <StatusBadge status={img.status} message={img.progress} />
              <span className="flex-1 text-[9px] font-medium truncate min-w-0"
                style={{ color: 'var(--lt-text-subtle)' }} title={img.name}>
                {img.name}
              </span>
              {img.status === 'done' && (
                <button
                  onClick={() => onDownload(img)}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded-[6px] hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: 'var(--lt-accent)', color: '#fff' }}
                  title="Download">
                  <Download size={11} />
                </button>
              )}
              <button
                onClick={() => onRemove(img.id)}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-[6px] hover:opacity-80 transition-opacity"
                style={{ backgroundColor: 'var(--lt-card-hover)', color: 'var(--lt-text-subtle)' }}
                title="Remove from list">
                <X size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
