'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, Download, Loader2, SlidersHorizontal, Wand2 } from 'lucide-react'
import BgRemoverPanel from './BgRemoverPanel'
import ImageQueue from './ImageQueue'
import TierSelector from './TierSelector'
import { cn } from '@/lib/utils'
import { useProviderStatus } from '@/hooks/useProviderStatus'
import { friendlyMessageFor } from '@/lib/bgRemoveMessages'

const PRESET_DIMS = {
  square:    { w: 1080, h: 1080 },
  portrait:  { w: 1080, h: 1920 },
  landscape: { w: 1920, h: 1080 },
}

let _idCounter = 0
function nextId() { return ++_idCounter }

export default function BgRemoverTool() {
  const [images,      setImages]      = useState([])
  const [modelMsg,    setModelMsg]    = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [tier,        setTier]        = useState('normal')
  const providerStatus = useProviderStatus()

  // Panel / download settings
  const [bgTab,        setBgTab]        = useState('color')
  const [bgColor,      setBgColor]      = useState('#ffffff')
  const [bgImageUrl,   setBgImageUrl]   = useState(null)
  const [activeBgId,   setActiveBgId]   = useState(null)
  const [resizePreset, setResizePreset] = useState('original')
  const [canvasW,      setCanvasW]      = useState(1080)
  const [canvasH,      setCanvasH]      = useState(1080)
  const [hdValue,      setHdValue]      = useState(50)
  const [fillToCanvas, setFillToCanvas] = useState(false)
  const [origDims,     setOrigDims]     = useState({ w: 1080, h: 1080 })

  // Mobile drawer visibility (left settings panel)
  const [showPanel, setShowPanel] = useState(false)

  const workerRef = useRef(null)
  const bgImgRef  = useRef(null)

  // ── Load background image (used when compositing selected images for download) ──
  useEffect(() => {
    bgImgRef.current = null
    if (!bgImageUrl) return
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { bgImgRef.current = img }
    img.src = bgImageUrl
  }, [bgImageUrl])

  // ── Init Web Worker ────────────────────────────────────────────────────────
  useEffect(() => {
    const worker = new Worker(new URL('../../workers/bg-worker.js', import.meta.url))
    workerRef.current = worker

    worker.onmessage = ({ data }) => {
      switch (data.type) {
        case 'load_progress':
          setModelMsg(data.message)
          break
        case 'progress':
          setImages(prev => prev.map(img =>
            img.id === data.id
              ? { ...img, status: 'processing', progress: data.message }
              : img
          ))
          break
        case 'done':
          setImages(prev => prev.map(img => {
            if (img.id !== data.id) return img
            if (img.processedUrl?.startsWith('blob:')) URL.revokeObjectURL(img.processedUrl)
            return { ...img, status: 'done', processedUrl: data.url, progress: '' }
          }))
          setModelMsg('')
          break
        case 'error':
          setImages(prev => prev.map(img =>
            img.id === data.id
              ? { ...img, status: 'error', error: data.error, progress: '' }
              : img
          ))
          setModelMsg('')
          break
      }
    }

    return () => worker.terminate()
  }, [])

  // ── Upload files ───────────────────────────────────────────────────────────
  function handleFilesChange(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const newImages = files.map(file => ({
      id: nextId(),
      file,
      name: file.name,
      originalUrl:  URL.createObjectURL(file),
      processedUrl: null,
      status:   'pending',
      progress: '',
      error:    '',
    }))

    setImages(prev => {
      const first = newImages[0]
      if (first) {
        const probe = new window.Image()
        probe.onload = () => setOrigDims({ w: probe.naturalWidth, h: probe.naturalHeight })
        probe.src = first.originalUrl
      }
      return [...prev, ...newImages]
    })

    // Auto-select newly uploaded images so they're ready for a bulk action
    setSelectedIds(prev => {
      const next = new Set(prev)
      newImages.forEach(img => next.add(img.id))
      return next
    })
    e.target.value = ''
  }

  // ── Toggle selection ────────────────────────────────────────────────────────
  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Remove image from list ─────────────────────────────────────────────────
  function handleRemoveImage(id) {
    setImages(prev => {
      const img = prev.find(i => i.id === id)
      if (img?.originalUrl?.startsWith('blob:'))  URL.revokeObjectURL(img.originalUrl)
      if (img?.processedUrl?.startsWith('blob:')) URL.revokeObjectURL(img.processedUrl)
      return prev.filter(i => i.id !== id)
    })
    setSelectedIds(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  // ── Process single image ───────────────────────────────────────────────────
  function handleProcessImage(id) {
    if (tier === 'normal') {
      const worker = workerRef.current
      if (!worker) return
      setImages(prev => {
        const img = prev.find(i => i.id === id)
        if (!img || (img.status !== 'pending' && img.status !== 'error')) return prev
        worker.postMessage({ id: img.id, url: img.originalUrl })
        return prev.map(i =>
          i.id === id ? { ...i, status: 'processing', progress: 'Queued…', error: '' } : i
        )
      })
      return
    }

    if (!providerStatus[tier]) return
    const img = images.find(i => i.id === id)
    if (!img || (img.status !== 'pending' && img.status !== 'error')) return
    runServerTierQueue([img], tier)
  }

  // ── Server-tier (Medium/Advanced/Pro) sequential processing ────────────────
  async function processImageViaProvider(img, tierKey) {
    setImages(prev => prev.map(i =>
      i.id === img.id ? { ...i, status: 'processing', progress: 'Uploading…', error: '' } : i
    ))

    try {
      const srcBlob = await (await fetch(img.originalUrl)).blob()
      const form = new FormData()
      form.append('image', srcBlob, img.name)

      const res = await fetch(`/api/bg-remove/${tierKey}`, { method: 'POST', body: form })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(friendlyMessageFor(data.code) || data.error || 'Background removal failed')
      }

      const url = URL.createObjectURL(await res.blob())
      setImages(prev => prev.map(i => {
        if (i.id !== img.id) return i
        if (i.processedUrl?.startsWith('blob:')) URL.revokeObjectURL(i.processedUrl)
        return { ...i, status: 'done', processedUrl: url, progress: '' }
      }))
    } catch (err) {
      setImages(prev => prev.map(i =>
        i.id === img.id ? { ...i, status: 'error', error: err.message, progress: '' } : i
      ))
    }
  }

  async function runServerTierQueue(eligible, tierKey) {
    setImages(prev => prev.map(img =>
      eligible.some(e => e.id === img.id) ? { ...img, status: 'processing', progress: 'Queued…' } : img
    ))
    for (const img of eligible) {
      await processImageViaProvider(img, tierKey)
    }
  }

  // ── Canvas compositing for download ───────────────────────────────────────
  function compositeAndDownload(img, filename) {
    return new Promise(resolve => {
      const fgEl = new window.Image()
      fgEl.crossOrigin = 'anonymous'
      fgEl.onload = () => {
        const imgW = fgEl.naturalWidth
        const imgH = fgEl.naturalHeight

        const outW = resizePreset === 'original' ? imgW : canvasW
        const outH = resizePreset === 'original' ? imgH : canvasH

        const scale  = 1 + (hdValue / 100) * 2
        const offscreen = document.createElement('canvas')
        offscreen.width  = outW * scale
        offscreen.height = outH * scale
        const ctx = offscreen.getContext('2d')
        ctx.scale(scale, scale)

        const useBgImg = bgTab === 'image' &&
          bgImgRef.current?.complete && bgImgRef.current.naturalWidth > 0
        if (useBgImg) {
          ctx.drawImage(bgImgRef.current, 0, 0, outW, outH)
        } else if (bgColor !== 'transparent') {
          ctx.fillStyle = bgColor
          ctx.fillRect(0, 0, outW, outH)
        }

        if (fillToCanvas) {
          ctx.drawImage(fgEl, 0, 0, outW, outH)
        } else {
          const s = Math.min(outW / imgW, outH / imgH)
          const w = imgW * s
          const h = imgH * s
          ctx.drawImage(fgEl, (outW - w) / 2, (outH - h) / 2, w, h)
        }

        offscreen.toBlob(blob => {
          if (blob) {
            const a = document.createElement('a')
            a.href     = URL.createObjectURL(blob)
            a.download = filename
            a.click()
          }
          resolve()
        }, 'image/png')
      }
      fgEl.onerror = resolve
      fgEl.src = img.processedUrl || img.originalUrl
    })
  }

  async function handleDownloadImage(img) {
    const base = img.name.replace(/\.[^.]+$/, '')
    await compositeAndDownload(img, `${base}-nobg.png`)
  }

  // ── Bulk actions — scoped to the current selection only ─────────────────────
  function handleRemoveSelected() {
    const eligible = images.filter(img =>
      selectedIds.has(img.id) && (img.status === 'pending' || img.status === 'error')
    )
    if (!eligible.length) return

    if (tier === 'normal') {
      const worker = workerRef.current
      if (!worker) return
      eligible.forEach(img => worker.postMessage({ id: img.id, url: img.originalUrl }))
      setImages(prev => prev.map(img =>
        eligible.some(e => e.id === img.id) ? { ...img, status: 'processing', progress: 'Queued…' } : img
      ))
      return
    }

    if (!providerStatus[tier]) return
    runServerTierQueue(eligible, tier)
  }

  async function handleDownloadSelected() {
    const done = images.filter(img => selectedIds.has(img.id) && img.status === 'done')
    for (const img of done) {
      const base = img.name.replace(/\.[^.]+$/, '')
      await compositeAndDownload(img, `${base}-nobg.png`)
      await new Promise(r => setTimeout(r, 250))
    }
  }

  // ── Preset / background helpers ────────────────────────────────────────────
  function handlePresetChange(id) {
    setResizePreset(id)
    if (id === 'original') {
      setCanvasW(origDims.w); setCanvasH(origDims.h)
    } else if (id === 'custom') {
      // canvasW/H already updated by applySize before calling this
    } else {
      const d = PRESET_DIMS[id]
      if (d) { setCanvasW(d.w); setCanvasH(d.h) }
    }
  }

  function handleSelectSampleBg(id, colors) {
    setActiveBgId(id)
    const off = document.createElement('canvas')
    off.width = 1920; off.height = 1080
    const ctx  = off.getContext('2d')
    const grad = ctx.createLinearGradient(0, 0, off.width, off.height)
    colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, off.width, off.height)
    off.toBlob(blob => setBgImageUrl(URL.createObjectURL(blob)))
  }

  function handleUploadBgImage(file) {
    setActiveBgId(null)
    setBgImageUrl(URL.createObjectURL(file))
  }

  // ── Derived counts ─────────────────────────────────────────────────────────
  const doneCount = images.filter(i => i.status === 'done').length
  const selectedCount = selectedIds.size
  const selectedEligibleCount = images.filter(img =>
    selectedIds.has(img.id) && (img.status === 'pending' || img.status === 'error')
  ).length
  const selectedDoneCount = images.filter(img => selectedIds.has(img.id) && img.status === 'done').length

  function openPanel() { setShowPanel(true) }
  function closeDrawers() { setShowPanel(false) }

  return (
    <div className="relative flex h-full overflow-hidden">

      {/* Mobile drawer backdrop */}
      {showPanel && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={closeDrawers} />
      )}

      {/* ── Background/Resize/HD panel — desktop sidebar, mobile bottom sheet ── */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out',
          'lg:static lg:inset-auto lg:z-auto lg:w-[272px] lg:max-w-none lg:max-h-none lg:shrink-0 lg:translate-y-0 lg:rounded-none lg:overflow-visible lg:shadow-none lg:border-r lg:transition-none',
          showPanel ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{ borderColor: 'var(--lt-divider)', backgroundColor: 'var(--lt-surface)' }}
      >
        {/* Mobile-only: drag handle, tap to close — bottom sheet is easier to reach/dismiss on mobile than a side drawer */}
        <button
          onClick={closeDrawers}
          className="lg:hidden sticky top-0 z-10 flex items-center justify-center pt-2.5 pb-1.5 w-full"
          style={{ backgroundColor: 'var(--lt-surface)' }}
          aria-label="Close settings"
        >
          <span className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--lt-divider-light)' }} />
        </button>
        <BgRemoverPanel
          bgTab={bgTab}               setBgTab={setBgTab}
          bgColor={bgColor}           setBgColor={setBgColor}
          activeBgId={activeBgId}
          resizePreset={resizePreset}
          canvasW={canvasW}           setCanvasW={setCanvasW}
          canvasH={canvasH}           setCanvasH={setCanvasH}
          hdValue={hdValue}           setHdValue={setHdValue}
          fillToCanvas={fillToCanvas} setFillToCanvas={setFillToCanvas}
          origDims={origDims}
          onPresetChange={handlePresetChange}
          onSelectSampleBg={handleSelectSampleBg}
          onUploadBgImage={handleUploadBgImage}
        />
      </div>

      {/* ── Center + right ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ backgroundColor: 'var(--lt-bg-base)' }}>

        {/* Toolbar */}
        <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3"
          style={{ borderBottom: '1px solid var(--lt-divider)', backgroundColor: 'var(--lt-surface)' }}>

          {/* Mobile-only: open settings panel drawer */}
          <div className="flex items-center gap-1.5 lg:hidden">
            <button
              onClick={openPanel}
              className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-full transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--lt-card)', border: '1px solid var(--lt-divider)', color: 'var(--lt-text-primary)' }}
            >
              <SlidersHorizontal size={13} />
              Edit
            </button>
          </div>

          {modelMsg ? (
            <span className="order-last sm:order-none w-full sm:w-auto flex items-center gap-2 text-xs sm:mr-auto" style={{ color: 'var(--lt-text-muted)' }}>
              <Loader2 size={12} className="animate-spin" />
              {modelMsg}
            </span>
          ) : (
            <span className="order-last sm:order-none w-full sm:w-auto sm:mr-auto text-xs font-semibold" style={{ color: 'var(--lt-text-subtle)' }}>
              {images.length > 0
                ? `${images.length} image${images.length > 1 ? 's' : ''} · ${doneCount} done${selectedCount ? ` · ${selectedCount} selected` : ''}`
                : 'No images yet'}
            </span>
          )}

          <label
            className="flex items-center gap-2 px-3 sm:px-4 py-2 text-white text-sm font-semibold rounded-full cursor-pointer hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--lt-success)' }}
          >
            <Upload size={14} />
            <span className="hidden sm:inline">Upload Images</span>
            <input type="file" accept="image/*" multiple className="sr-only" onChange={handleFilesChange} />
          </label>

          {/* Quality tier + Remove BG stay adjacent — tier only configures this action */}
          <div className="flex items-center gap-1.5">
            <TierSelector tier={tier} setTier={setTier} status={providerStatus} />

            <button
              onClick={handleRemoveSelected}
              disabled={selectedEligibleCount === 0}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 text-white text-sm font-semibold rounded-full hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#3b68f9' }}
            >
              <Wand2 size={14} />
              <span className="hidden sm:inline">Remove BG</span>
              {selectedEligibleCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                  {selectedEligibleCount}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={handleDownloadSelected}
            disabled={selectedDoneCount === 0}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 text-white text-sm font-semibold rounded-full hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--lt-accent)' }}
          >
            <Download size={14} />
            <span className="hidden sm:inline">Download</span>
            {selectedDoneCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                {selectedDoneCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Image grid: check tiles to select — Remove BG / Download act on the selection only ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <ImageQueue
            images={images}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onRemove={handleRemoveImage}
            onDownload={handleDownloadImage}
            onProcess={handleProcessImage}
            bgTab={bgTab}
            bgColor={bgColor}
            bgImageUrl={bgImageUrl}
          />
        </div>
      </div>
    </div>
  )
}
