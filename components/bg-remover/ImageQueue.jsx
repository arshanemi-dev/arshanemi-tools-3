'use client'

import { X, Download, Loader2, CheckCircle2, AlertCircle, Clock, Wand2, RefreshCw } from 'lucide-react'

function CheckerboardBg() {
  return (
    <div className="absolute inset-0" style={{
      backgroundImage: 'repeating-conic-gradient(#b0b0b0 0% 25%, #ffffff 0% 50%)',
      backgroundSize: '12px 12px',
    }} />
  )
}

function StatusBadge({ status, message }) {
  if (status === 'pending') return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold shrink-0"
      style={{ backgroundColor: 'var(--lt-card-hover)', color: 'var(--lt-text-subtle)' }}>
      <Clock size={8} />Pending
    </span>
  )
  if (status === 'processing') return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold shrink-0"
      style={{ backgroundColor: 'rgba(59,104,249,0.18)', color: '#3b68f9' }}>
      <Loader2 size={8} className="animate-spin" />Processing
    </span>
  )
  if (status === 'done') return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold shrink-0"
      style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
      <CheckCircle2 size={8} />Done
    </span>
  )
  if (status === 'error') return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold shrink-0"
      style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
      <AlertCircle size={8} />Error
    </span>
  )
  return null
}

export default function ImageQueue({ images, selectedId, onSelect, onRemove, onDownload, onProcess }) {
  if (!images.length) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
      <div className="w-14 h-14 rounded-xl flex items-center justify-center"
        style={{ border: '2px dashed var(--lt-divider-light)', backgroundColor: 'var(--lt-card)' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--lt-divider-light)" strokeWidth="1.5">
          <rect x="2" y="2" width="9" height="9" rx="1.5" />
          <rect x="13" y="2" width="9" height="9" rx="1.5" />
          <rect x="2" y="13" width="9" height="9" rx="1.5" />
          <rect x="13" y="13" width="9" height="9" rx="1.5" />
        </svg>
      </div>
      <p className="text-[11px] text-center leading-relaxed" style={{ color: 'var(--lt-text-subtle)' }}>
        No images yet.<br />Upload to get started.
      </p>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
      {images.map(img => {
        const isSelected = img.id === selectedId
        return (
          <div
            key={img.id}
            onClick={() => onSelect(img.id)}
            className="rounded-[10px] overflow-hidden cursor-pointer transition-all"
            style={{
              border: isSelected
                ? '2px solid var(--lt-accent)'
                : '1px solid var(--lt-divider)',
              backgroundColor: 'var(--lt-card)',
              boxShadow: isSelected ? '0 0 0 3px rgba(79,70,229,0.18)' : 'none',
            }}
          >
            {/* Thumbnail */}
            <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
              {img.processedUrl && <CheckerboardBg />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.processedUrl || img.originalUrl}
                alt={img.name}
                className="relative w-full h-full object-contain"
              />

              {img.status === 'processing' && (
                <div className="absolute inset-0 flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                  <Loader2 size={18} className="animate-spin text-white" />
                </div>
              )}

              {img.status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2"
                  style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
                  <AlertCircle size={14} className="text-red-400" />
                  <p className="text-[8px] text-red-300 text-center leading-tight">{img.error || 'Failed'}</p>
                </div>
              )}
            </div>

            {/* Footer row */}
            <div className="px-2 py-1.5 flex items-center gap-1"
              style={{ borderTop: '1px solid var(--lt-divider)' }}
              onClick={e => e.stopPropagation()}>

              <StatusBadge status={img.status} message={img.progress} />
              <span className="flex-1 min-w-0" />

              {/* Per-status action */}
              {img.status === 'pending' && (
                <button onClick={() => onProcess(img.id)}
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded-[5px] hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: '#3b68f9', color: '#fff' }} title="Remove BG">
                  <Wand2 size={10} />
                </button>
              )}
              {img.status === 'error' && (
                <button onClick={() => onProcess(img.id)}
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded-[5px] hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: '#ef4444', color: '#fff' }} title="Retry">
                  <RefreshCw size={10} />
                </button>
              )}
              {img.status === 'done' && (
                <button onClick={() => onDownload(img)}
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded-[5px] hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: 'var(--lt-accent)', color: '#fff' }} title="Download">
                  <Download size={10} />
                </button>
              )}

              {/* Remove from list */}
              <button onClick={() => onRemove(img.id)}
                className="shrink-0 w-5 h-5 flex items-center justify-center rounded-[5px] hover:opacity-80 transition-opacity"
                style={{ backgroundColor: 'var(--lt-card-hover)', color: 'var(--lt-text-subtle)' }} title="Remove">
                <X size={10} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
