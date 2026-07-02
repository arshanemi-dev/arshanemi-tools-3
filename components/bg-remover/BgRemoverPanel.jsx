'use client'

import { useState, useRef } from 'react'
import { CloudUpload, Lock, Unlock } from 'lucide-react'

const BG_COLORS = [
  '#ffffff', '#9ca3af', '#7c3aed', '#f59e0b',
  '#f97316', '#e11d48', '#ec4899', '#3b82f6',
  '#22c55e', '#ef4444', '#c084fc', '#06b6d4',
  '#fbbf24', '#1e293b', '#000000',
]

const SAMPLE_BGS = [
  { id: 1, colors: ['#d4900a', '#7a4f00', '#3a2300'], css: 'linear-gradient(135deg,#d4900a,#7a4f00,#3a2300)' },
  { id: 2, colors: ['#a0714f', '#7a5230', '#3a200a'], css: 'linear-gradient(135deg,#a0714f,#7a5230,#3a200a)' },
  { id: 3, colors: ['#6b7fa3', '#3d5478', '#1c2f54'], css: 'linear-gradient(135deg,#6b7fa3,#3d5478,#1c2f54)' },
  { id: 4, colors: ['#d4c47a', '#b8a040', '#6a5a10'], css: 'linear-gradient(135deg,#d4c47a,#b8a040,#6a5a10)' },
  { id: 5, colors: ['#4a8c60', '#1f6035', '#073018'], css: 'linear-gradient(135deg,#4a8c60,#1f6035,#073018)' },
  { id: 6, colors: ['#7ec8e3', '#2e9ab8', '#0a5a7a'], css: 'linear-gradient(135deg,#7ec8e3,#2e9ab8,#0a5a7a)' },
]

const PRESETS = [
  { id: 'original',  label: 'Original',  get dims() { return null } },
  { id: 'square',    label: 'Square',    dims: '1080×1080' },
  { id: 'portrait',  label: 'Portrait',  dims: '1080×1920' },
  { id: 'landscape', label: 'Landscape', dims: '1920×1080' },
]

function PresetShape({ id, active }) {
  const color = active ? 'var(--lt-accent-light)' : 'var(--lt-text-subtle)'
  const s = { border: `2px solid ${color}`, flexShrink: 0, borderRadius: 3 }
  if (id === 'original')  return <div style={{ ...s, width: 18, height: 22 }} />
  if (id === 'square')    return <div style={{ ...s, width: 22, height: 22 }} />
  if (id === 'portrait')  return <div style={{ ...s, width: 13, height: 26, borderRadius: 30 }} />
  if (id === 'landscape') return <div style={{ ...s, width: 30, height: 15, borderRadius: 30 }} />
  return null
}

function SectionIcon({ type }) {
  if (type === 'bg') return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x=".75" y=".75" width="13.5" height="13.5" rx="2" stroke="currentColor" strokeWidth="1.1" strokeDasharray="3 1.5"/>
      <rect x="1.5" y="1.5" width="3" height="3" fill="currentColor" opacity=".4" rx=".5"/>
      <rect x="6"   y="1.5" width="3" height="3" fill="currentColor" opacity=".7" rx=".5"/>
      <rect x="10.5"y="1.5" width="3" height="3" fill="currentColor" opacity=".4" rx=".5"/>
      <rect x="1.5" y="6"   width="3" height="3" fill="currentColor" opacity=".7" rx=".5"/>
      <rect x="6"   y="6"   width="3" height="3" fill="currentColor" opacity=".4" rx=".5"/>
      <rect x="10.5"y="6"   width="3" height="3" fill="currentColor" opacity=".7" rx=".5"/>
    </svg>
  )
  if (type === 'resize') return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x=".75" y="2.25" width="9" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
      <rect x="5.25" y=".75" width="9" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.1" fill="var(--lt-surface)"/>
    </svg>
  )
  return null
}

function HdBadge() {
  return (
    <div style={{ background:'var(--lt-text-subtle)', borderRadius:3, padding:'0 4px', height:16, display:'flex', alignItems:'center' }}>
      <span style={{ fontSize:8, fontWeight:800, color:'var(--lt-surface)', letterSpacing:.5 }}>HD</span>
    </div>
  )
}

export default function BgRemoverPanel({
  bgTab, setBgTab,
  bgColor, setBgColor,
  activeBgId,
  resizePreset,
  canvasW, setCanvasW,
  canvasH, setCanvasH,
  hdValue, setHdValue,
  fillToCanvas, setFillToCanvas,
  origDims,
  onPresetChange,
  onSelectSampleBg, onUploadBgImage,
}) {
  const [locked,    setLocked]    = useState(true)
  const [showApply, setShowApply] = useState(false)
  const [tempW,     setTempW]     = useState(canvasW)
  const [tempH,     setTempH]     = useState(canvasH)
  const colorPickerRef  = useRef(null)
  const bgUploadRef     = useRef(null)

  // Sync temp dims when external canvasW/H changes (preset click)
  function syncTemps(w, h) { setTempW(w); setTempH(h) }

  function handlePreset(p) {
    onPresetChange(p.id)
    const w = p.id === 'original' ? origDims.w : parseInt(p.dims)
    const h = p.id === 'original' ? origDims.h : parseInt(p.dims.split('×')[1])
    syncTemps(w, h)
    setShowApply(false)
  }

  function handleW(val) {
    const n = Math.max(1, Number(val))
    setTempW(n)
    if (locked && canvasH > 0) setTempH(Math.round(n * canvasH / canvasW))
    setShowApply(true)
  }

  function handleH(val) {
    const n = Math.max(1, Number(val))
    setTempH(n)
    if (locked && canvasW > 0) setTempW(Math.round(n * canvasW / canvasH))
    setShowApply(true)
  }

  function applySize() {
    setCanvasW(tempW)
    setCanvasH(tempH)
    setShowApply(false)
  }

  function cancelSize() {
    setTempW(canvasW)
    setTempH(canvasH)
    setShowApply(false)
  }

  const inputCls = 'flex-1 text-center text-sm px-2 py-2 rounded-[8px] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none'

  return (
    <div className="w-[272px] shrink-0 h-full overflow-y-auto"
      style={{ borderRight: '1px solid var(--lt-divider)', backgroundColor: 'var(--lt-surface)' }}>
      <div className="p-4 flex flex-col gap-5">

        {/* ── Background ─────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2" style={{ color: 'var(--lt-text-primary)' }}>
            <SectionIcon type="bg" />
            <span className="text-sm font-bold">Background</span>
          </div>

          <p className="text-[11px]" style={{ color: 'var(--lt-text-muted)' }}>
            Set background &amp; export options for download
          </p>

          {/* Color / Image toggle */}
          <div className="flex p-0.5 rounded-full" style={{ backgroundColor: 'var(--lt-card)' }}>
            {['Color', 'Image'].map(t => {
              const active = bgTab === t.toLowerCase()
              return (
                <button key={t} onClick={() => setBgTab(t.toLowerCase())}
                  className="flex-1 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
                  style={{ backgroundColor: active ? 'var(--lt-text-primary)' : 'transparent', color: active ? 'var(--lt-bg-base)' : 'var(--lt-text-subtle)' }}>
                  {t}
                </button>
              )
            })}
          </div>

          {/* Color swatches */}
          {bgTab === 'color' && (
            <div className="flex flex-wrap gap-2">
              {BG_COLORS.map(hex => (
                <button key={hex} onClick={() => setBgColor(hex)}
                  className="w-8 h-8 rounded-full shrink-0 transition-all hover:scale-110"
                  style={{
                    backgroundColor: hex,
                    outline: bgColor === hex ? '2.5px solid var(--lt-accent)' : '2.5px solid transparent',
                    outlineOffset: 2,
                    border: hex === '#ffffff' ? '1px solid var(--lt-divider)' : 'none',
                  }}
                />
              ))}
              {/* Custom color picker */}
              <button
                onClick={() => colorPickerRef.current?.click()}
                className="w-8 h-8 rounded-full shrink-0 overflow-hidden transition-all hover:scale-110"
                style={{ background: 'conic-gradient(red 0deg,yellow 60deg,lime 120deg,cyan 180deg,blue 240deg,magenta 300deg,red 360deg)' }}
              />
              <input ref={colorPickerRef} type="color" className="sr-only" value={bgColor}
                onChange={e => setBgColor(e.target.value)} />
            </div>
          )}

          {/* Sample background images */}
          {bgTab === 'image' && (
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => bgUploadRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-white text-sm font-semibold rounded-[8px] transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--lt-success)' }}
              >
                <CloudUpload size={15} />
                Upload image
              </button>
              <input ref={bgUploadRef} type="file" accept="image/*" className="sr-only"
                onChange={e => { const f = e.target.files?.[0]; if (f) onUploadBgImage(f); e.target.value = '' }} />

              <div className="grid grid-cols-3 gap-1.5">
                {SAMPLE_BGS.map(bg => (
                  <button key={bg.id} onClick={() => onSelectSampleBg(bg.id, bg.colors)}
                    className="aspect-square rounded-[7px] overflow-hidden transition-all hover:opacity-90"
                    style={{
                      background: bg.css,
                      outline: activeBgId === bg.id ? '2.5px solid var(--lt-accent)' : '2.5px solid transparent',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="h-px" style={{ backgroundColor: 'var(--lt-divider)' }} />

        {/* ── Resize ─────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2" style={{ color: 'var(--lt-text-primary)' }}>
            <SectionIcon type="resize" />
            <span className="text-sm font-bold">Resize</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map(p => {
              const active = resizePreset === p.id
              const dimStr = p.id === 'original'
                ? `${origDims.w}×${origDims.h}`
                : p.dims
              return (
                <button key={p.id} onClick={() => handlePreset(p)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] border text-left transition-all"
                  style={{
                    borderColor: active ? 'var(--lt-accent)' : 'var(--lt-divider)',
                    backgroundColor: active ? 'var(--lt-accent-muted)' : 'var(--lt-card)',
                  }}>
                  <PresetShape id={p.id} active={active} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold leading-tight" style={{ color: 'var(--lt-text-primary)' }}>{p.label}</p>
                    <p className="text-[9px] leading-tight mt-0.5" style={{ color: 'var(--lt-text-subtle)' }}>{dimStr}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* W × H inputs */}
          <div className="flex items-center gap-2">
            <input type="number" value={tempW} onChange={e => handleW(e.target.value)}
              className={inputCls}
              style={{ backgroundColor:'var(--lt-card)', border:'1px solid var(--lt-divider)', color:'var(--lt-text-primary)' }} />
            <button onClick={() => setLocked(l => !l)}
              className="p-2 shrink-0 rounded-[8px] transition-colors"
              style={{ backgroundColor:'var(--lt-card)', border:'1px solid var(--lt-divider)', color: locked ? 'var(--lt-accent-light)' : 'var(--lt-text-subtle)' }}>
              {locked ? <Lock size={13} /> : <Unlock size={13} />}
            </button>
            <input type="number" value={tempH} onChange={e => handleH(e.target.value)}
              className={inputCls}
              style={{ backgroundColor:'var(--lt-card)', border:'1px solid var(--lt-divider)', color:'var(--lt-text-primary)' }} />
          </div>

          {showApply && (
            <div className="flex gap-2 animate-fadeIn">
              <button onClick={applySize}
                className="flex-1 py-2 text-white text-sm font-semibold rounded-[8px] hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#3b68f9' }}>
                Apply
              </button>
              <button onClick={cancelSize}
                className="px-4 py-2 text-sm font-semibold rounded-[8px] hover:opacity-80 transition-opacity"
                style={{ backgroundColor:'var(--lt-text-primary)', color:'var(--lt-bg-base)' }}>
                Cancel
              </button>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={fillToCanvas} onChange={e => setFillToCanvas(e.target.checked)}
              className="w-4 h-4 rounded" style={{ accentColor:'var(--lt-accent)' }} />
            <span className="text-xs" style={{ color:'var(--lt-text-muted)' }}>Fill image to canvas</span>
          </label>
        </section>

        <div className="h-px" style={{ backgroundColor: 'var(--lt-divider)' }} />

        {/* ── HD Image ───────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2" style={{ color:'var(--lt-text-primary)' }}>
            <HdBadge />
            <span className="text-sm font-bold">HD Image</span>
            <span className="ml-auto text-xs font-semibold" style={{ color:'var(--lt-accent-light)' }}>
              {(1 + (hdValue / 100) * 2).toFixed(1)}×
            </span>
          </div>
          <input type="range" min={0} max={100} value={hdValue}
            onChange={e => setHdValue(Number(e.target.value))}
            className="w-full" style={{ accentColor:'var(--lt-accent)' }} />
          <div className="flex justify-between text-[10px]" style={{ color:'var(--lt-text-subtle)' }}>
            <span>Standard</span>
            <span>HD</span>
            <span>Ultra HD</span>
          </div>
        </section>

      </div>
    </div>
  )
}
