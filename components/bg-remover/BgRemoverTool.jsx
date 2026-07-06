'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Download, Loader2, ImageIcon, SlidersHorizontal, X } from 'lucide-react'
import BgRemoverPanel from './BgRemoverPanel'
import ImageQueue from './ImageQueue'
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
  const [images,     setImages]     = useState([])
  const [modelMsg,   setModelMsg]   = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [tier,       setTier]       = useState('normal')
  const providerStatus = useProviderStatus()
  // drawTick bumps when images finish loading so redraw fires
  const [drawTick,   setDrawTick]   = useState(0)

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

  // Mobile drawer visibility (left settings panel / right image queue)
  const [showPanel, setShowPanel] = useState(false)
  const [showQueue, setShowQueue] = useState(false)

  const workerRef = useRef(null)
  const canvasRef = useRef(null)
  const fgRef     = useRef(null)
  const bgImgRef  = useRef(null)

  const selectedImage = images.find(i => i.id === selectedId) ?? null

  // ── Live canvas redraw ─────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const fg  = fgRef.current

    const imgW = fg?.naturalWidth  || 1
    const imgH = fg?.naturalHeight || 1
    const outW = resizePreset === 'original' ? imgW : canvasW
    const outH = resizePreset === 'original' ? imgH : canvasH

    canvas.width  = outW
    canvas.height = outH
    ctx.clearRect(0, 0, outW, outH)

    // Background
    const useBgImg = bgTab === 'image' && bgImgRef.current?.naturalWidth > 0
    if (useBgImg) {
      ctx.drawImage(bgImgRef.current, 0, 0, outW, outH)
    } else if (bgColor !== 'transparent') {
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, outW, outH)
    }
    // transparent → canvas stays clear (checkerboard shown via CSS)

    // Foreground
    if (fg?.naturalWidth > 0) {
      if (fillToCanvas) {
        ctx.drawImage(fg, 0, 0, outW, outH)
      } else {
        const s = Math.min(outW / imgW, outH / imgH)
        const w = imgW * s
        const h = imgH * s
        ctx.drawImage(fg, (outW - w) / 2, (outH - h) / 2, w, h)
      }
    }
  // drawTick is included so a new redraw fires after images load
  }, [bgTab, bgColor, canvasW, canvasH, fillToCanvas, resizePreset, drawTick]) // eslint-disable-line

  useEffect(() => { redraw() }, [redraw])

  // ── Load foreground when selected image URL changes ────────────────────────
  useEffect(() => {
    const url = selectedImage?.processedUrl || selectedImage?.originalUrl
    fgRef.current = null
    if (!url) { setDrawTick(t => t + 1); return }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { fgRef.current = img; setDrawTick(t => t + 1) }
    img.onerror = () => { fgRef.current = null; setDrawTick(t => t + 1) }
    img.src = url
  }, [selectedId, selectedImage?.processedUrl, selectedImage?.originalUrl])

  // ── Load background image ──────────────────────────────────────────────────
  useEffect(() => {
    bgImgRef.current = null
    if (!bgImageUrl) { setDrawTick(t => t + 1); return }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { bgImgRef.current = img; setDrawTick(t => t + 1) }
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

    // Auto-select first new image if nothing selected
    setSelectedId(cur => cur ?? newImages[0].id)
    e.target.value = ''
  }

  // ── Remove image from list ─────────────────────────────────────────────────
  function handleRemoveImage(id) {
    setImages(prev => {
      const img = prev.find(i => i.id === id)
      if (img?.originalUrl?.startsWith('blob:'))  URL.revokeObjectURL(img.originalUrl)
      if (img?.processedUrl?.startsWith('blob:')) URL.revokeObjectURL(img.processedUrl)
      const next = prev.filter(i => i.id !== id)
      if (id === selectedId) setSelectedId(next[0]?.id ?? null)
      return next
    })
  }

  // ── Remove all backgrounds ─────────────────────────────────────────────────
  function handleRemoveAll() {
    if (tier === 'normal') {
      const worker = workerRef.current
      if (!worker) return
      setImages(prev => {
        const eligible = prev.filter(img => img.status === 'pending' || img.status === 'error')
        eligible.forEach(img => worker.postMessage({ id: img.id, url: img.originalUrl }))
        return prev.map(img =>
          eligible.some(e => e.id === img.id)
            ? { ...img, status: 'processing', progress: 'Queued…' }
            : img
        )
      })
      return
    }

    if (!providerStatus[tier]) return
    const eligible = images.filter(img => img.status === 'pending' || img.status === 'error')
    if (eligible.length) runServerTierQueue(eligible, tier)
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

  async function handleDownloadAll() {
    const done = images.filter(img => img.status === 'done')
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
  const doneCount     = images.filter(i => i.status === 'done').length
  const pendingCount  = images.filter(i => i.status === 'pending' || i.status === 'error').length
  const processingAny = images.some(i => i.status === 'processing')

  const showCheckerboard = bgColor === 'transparent' && bgTab === 'color'

  function openPanel() { setShowQueue(false); setShowPanel(true) }
  function openQueue() { setShowPanel(false); setShowQueue(true) }
  function closeDrawers() { setShowPanel(false); setShowQueue(false) }

  return (
    <div className="relative flex h-full overflow-hidden">

      {/* Mobile drawer backdrop */}
      {(showPanel || showQueue) && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={closeDrawers} />
      )}

      {/* ── Background/Resize/HD panel — desktop sidebar, mobile slide-in drawer ── */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[280px] shadow-2xl transition-transform duration-300 ease-out',
          'lg:static lg:z-auto lg:w-[272px] lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:shadow-none lg:border-r lg:transition-none',
          showPanel ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ borderColor: 'var(--lt-divider)' }}
      >
        <BgRemoverPanel
          tier={tier}                 setTier={setTier}
          providerStatus={providerStatus}
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

          {/* Mobile-only: open settings panel / image queue drawers */}
          <div className="flex items-center gap-1.5 lg:hidden">
            <button
              onClick={openPanel}
              className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-full transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--lt-card)', border: '1px solid var(--lt-divider)', color: 'var(--lt-text-primary)' }}
            >
              <SlidersHorizontal size={13} />
              Edit
            </button>
            <button
              onClick={openQueue}
              className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-full transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--lt-card)', border: '1px solid var(--lt-divider)', color: 'var(--lt-text-primary)' }}
            >
              <ImageIcon size={13} />
              {images.length > 0 ? images.length : 'Images'}
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
                ? `${images.length} image${images.length > 1 ? 's' : ''} · ${doneCount} done`
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

          <button
            onClick={handleRemoveAll}
            disabled={pendingCount === 0 || processingAny}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 text-white text-sm font-semibold rounded-full hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#3b68f9' }}
          >
            {processingAny ? <Loader2 size={14} className="animate-spin" /> : null}
            <span className="hidden sm:inline">Remove All BG</span>
            {pendingCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={handleDownloadAll}
            disabled={doneCount === 0}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 text-white text-sm font-semibold rounded-full hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--lt-accent)' }}
          >
            <Download size={14} />
            <span className="hidden sm:inline">Download All</span>
            {doneCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                {doneCount}
              </span>
            )}
          </button>
        </div>

        {/* Content row: canvas preview + image queue sidebar */}
        <div className="flex-1 flex overflow-hidden">

          {/* ── Canvas preview ── */}
          <div className="flex-1 min-w-0 flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-hidden">
            {!selectedImage ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 rounded-2xl flex items-center justify-center"
                  style={{ border: '2px dashed var(--lt-divider-light)', backgroundColor: 'var(--lt-card)' }}>
                  <ImageIcon size={36} style={{ color: 'var(--lt-divider-light)' }} />
                </div>
                <p className="text-sm text-center" style={{ color: 'var(--lt-text-subtle)' }}>
                  Upload images, then click one<br />in the sidebar to preview
                </p>
                <label className="px-5 py-2 text-sm font-semibold rounded-full cursor-pointer text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: 'var(--lt-accent)' }}>
                  Choose Images
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={handleFilesChange} />
                </label>
              </div>
            ) : (
              <div className="relative flex items-center justify-center w-full h-full">
                {/* Processing overlay */}
                {selectedImage.status === 'processing' && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 pointer-events-none">
                    <Loader2 size={30} className="animate-spin" style={{ color: 'var(--lt-accent)' }} />
                    <p className="text-sm font-semibold px-3 py-1.5 rounded-lg"
                      style={{ color: 'var(--lt-text-muted)', backgroundColor: 'var(--lt-card)' }}>
                      {selectedImage.progress || 'Processing…'}
                    </p>
                  </div>
                )}

                <canvas
                  ref={canvasRef}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 'calc(100vh - 190px)',
                    display: 'block',
                    borderRadius: 10,
                    boxShadow: '0 20px 60px -10px rgba(0,0,0,0.45)',
                    // Show checkerboard when transparent bg is active
                    backgroundImage: showCheckerboard
                      ? 'repeating-conic-gradient(#b0b0b0 0% 25%, #ffffff 0% 50%)'
                      : 'none',
                    backgroundSize: '20px 20px',
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Image queue: desktop sidebar, mobile slide-in drawer ── */}
          <div
            className={cn(
              'fixed inset-y-0 right-0 z-50 w-[85vw] max-w-[280px] flex flex-col overflow-hidden shadow-2xl transition-transform duration-300 ease-out',
              'lg:static lg:z-auto lg:w-[220px] lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:shadow-none lg:transition-none',
              showQueue ? 'translate-x-0' : 'translate-x-full'
            )}
            style={{ borderLeft: '1px solid var(--lt-divider)', backgroundColor: 'var(--lt-surface)' }}
          >
            <div className="px-3 py-2.5 shrink-0 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--lt-divider)' }}>
              <span className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--lt-text-subtle)' }}>
                Images
              </span>
              <div className="flex items-center gap-2">
                {images.length > 0 && (
                  <span className="text-[10px]" style={{ color: 'var(--lt-text-subtle)' }}>
                    {images.length}
                  </span>
                )}
                <button
                  onClick={() => setShowQueue(false)}
                  className="lg:hidden p-1 rounded-[5px] transition-colors"
                  style={{ color: 'var(--lt-text-subtle)' }}
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <ImageQueue
              images={images}
              selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); setShowQueue(false) }}
              onRemove={handleRemoveImage}
              onDownload={handleDownloadImage}
              onProcess={handleProcessImage}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
