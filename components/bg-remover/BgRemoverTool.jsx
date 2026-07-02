'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, Download, Loader2 } from 'lucide-react'
import BgRemoverPanel from './BgRemoverPanel'
import ImageQueue from './ImageQueue'

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

  const workerRef  = useRef(null)
  const bgImgRef   = useRef(null)

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
          setImages(prev => prev.map(img =>
            img.id === data.id
              ? { ...img, status: 'done', processedUrl: data.url, progress: '' }
              : img
          ))
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

  // Load background image element when URL changes
  useEffect(() => {
    if (!bgImageUrl) { bgImgRef.current = null; return }
    const el = new window.Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => { bgImgRef.current = el }
    el.src = bgImageUrl
  }, [bgImageUrl])

  // ── Upload files ─────────────────────────────────────────────────────────
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
      // Update origDims from first new image
      const first = newImages[0]
      if (first) {
        const probe = new window.Image()
        probe.onload = () => setOrigDims({ w: probe.naturalWidth, h: probe.naturalHeight })
        probe.src = first.originalUrl
      }
      return [...prev, ...newImages]
    })

    e.target.value = ''
  }

  // ── Remove image from list ───────────────────────────────────────────────
  function handleRemoveImage(id) {
    setImages(prev => {
      const img = prev.find(i => i.id === id)
      if (img?.originalUrl?.startsWith('blob:'))  URL.revokeObjectURL(img.originalUrl)
      if (img?.processedUrl?.startsWith('blob:')) URL.revokeObjectURL(img.processedUrl)
      return prev.filter(i => i.id !== id)
    })
  }

  // ── Remove all backgrounds ───────────────────────────────────────────────
  function handleRemoveAll() {
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
  }

  // ── Canvas compositing for download ─────────────────────────────────────
  function compositeAndDownload(img, filename) {
    return new Promise(resolve => {
      const fgEl = new window.Image()
      fgEl.crossOrigin = 'anonymous'
      fgEl.onload = () => {
        const imgW = fgEl.naturalWidth
        const imgH = fgEl.naturalHeight

        let outW, outH
        if (resizePreset === 'original' || !PRESET_DIMS[resizePreset]) {
          outW = imgW; outH = imgH
        } else {
          outW = PRESET_DIMS[resizePreset].w
          outH = PRESET_DIMS[resizePreset].h
        }

        const scale  = 1 + (hdValue / 100) * 2
        const canvas = document.createElement('canvas')
        canvas.width  = outW * scale
        canvas.height = outH * scale
        const ctx = canvas.getContext('2d')
        ctx.scale(scale, scale)

        const useBgImage = bgTab === 'image' &&
          bgImgRef.current?.complete && bgImgRef.current.naturalWidth > 0
        if (useBgImage) {
          ctx.drawImage(bgImgRef.current, 0, 0, outW, outH)
        } else {
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

        canvas.toBlob(blob => {
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

  // ── Preset / background helpers ──────────────────────────────────────────
  function handlePresetChange(id) {
    setResizePreset(id)
    if (id === 'original') {
      setCanvasW(origDims.w); setCanvasH(origDims.h)
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

  // ── Derived counts ───────────────────────────────────────────────────────
  const doneCount     = images.filter(i => i.status === 'done').length
  const pendingCount  = images.filter(i => i.status === 'pending' || i.status === 'error').length
  const processingAny = images.some(i => i.status === 'processing')

  return (
    <div className="flex h-full overflow-hidden">

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

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--lt-bg-base)' }}>

        {/* Toolbar */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: '1px solid var(--lt-divider)', backgroundColor: 'var(--lt-surface)' }}>

          {modelMsg ? (
            <span className="flex items-center gap-2 text-xs mr-auto" style={{ color: 'var(--lt-text-muted)' }}>
              <Loader2 size={12} className="animate-spin" />
              {modelMsg}
            </span>
          ) : (
            <span className="mr-auto text-xs font-semibold" style={{ color: 'var(--lt-text-subtle)' }}>
              {images.length > 0
                ? `${images.length} image${images.length > 1 ? 's' : ''} · ${doneCount} done`
                : 'No images yet'}
            </span>
          )}

          <label
            className="flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-full cursor-pointer hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--lt-success)' }}
          >
            <Upload size={14} />
            Upload Images
            <input type="file" accept="image/*" multiple className="sr-only" onChange={handleFilesChange} />
          </label>

          <button
            onClick={handleRemoveAll}
            disabled={pendingCount === 0 || processingAny}
            className="flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-full hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#3b68f9' }}
          >
            {processingAny
              ? <Loader2 size={14} className="animate-spin" />
              : null}
            Remove All BG
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
            className="flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-full hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--lt-accent)' }}
          >
            <Download size={14} />
            Download All
            {doneCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                {doneCount}
              </span>
            )}
          </button>
        </div>

        <ImageQueue
          images={images}
          onRemove={handleRemoveImage}
          onDownload={handleDownloadImage}
        />
      </div>
    </div>
  )
}
