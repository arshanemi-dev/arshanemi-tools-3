import { AutoModel, AutoProcessor, RawImage, env } from '@huggingface/transformers'

env.allowLocalModels = false
env.backends.onnx.wasm.proxy = false

const MODEL_ID = 'briaai/RMBG-1.4'

let model     = null
let processor = null

async function loadModel() {
  if (model && processor) return
  model = await AutoModel.from_pretrained(MODEL_ID, {
    config: { model_type: 'custom' },
    progress_callback: (p) => {
      if (p.status === 'progress') {
        self.postMessage({
          type: 'load_progress',
          message: `Downloading model… ${Math.round(p.progress)}%`,
        })
      }
    },
  })
  processor = await AutoProcessor.from_pretrained(MODEL_ID, {
    config: {
      do_normalize:  true,
      do_pad:        false,
      do_rescale:    true,
      do_resize:     true,
      image_mean:    [0.5, 0.5, 0.5],
      image_std:     [1, 1, 1],
      resample:      2,
      rescale_factor: 0.00392156862745098,
      size:          { width: 1024, height: 1024 },
      feature_extractor_type: 'ImageFeatureExtractor',
    },
  })
}

async function processImage(id, url) {
  try {
    self.postMessage({ type: 'progress', id, message: 'Loading model…' })
    await loadModel()

    self.postMessage({ type: 'progress', id, message: 'Removing background…' })

    const resp    = await fetch(url)
    const imgBlob = await resp.blob()
    const bitmap  = await createImageBitmap(imgBlob)
    const rawImg  = await RawImage.fromURL(url)

    const { pixel_values } = await processor(rawImg)
    const { output }       = await model({ input: pixel_values })

    const mask = await RawImage
      .fromTensor(output[0].mul(255).to('uint8'))
      .resize(bitmap.width, bitmap.height)

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx    = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0)

    const imgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
    for (let i = 0; i < mask.data.length; i++) {
      imgData.data[4 * i + 3] = mask.data[i]
    }
    ctx.putImageData(imgData, 0, 0)

    const resultBlob = await canvas.convertToBlob({ type: 'image/png' })
    const resultUrl  = URL.createObjectURL(resultBlob)
    self.postMessage({ type: 'done', id, url: resultUrl })
  } catch (err) {
    self.postMessage({ type: 'error', id, error: err.message || 'Processing failed' })
  }
}

// Sequential queue — worker processes one image at a time
const queue = []
let   running = false

async function drainQueue() {
  if (running) return
  running = true
  while (queue.length) {
    const { id, url } = queue.shift()
    await processImage(id, url)
  }
  running = false
}

self.onmessage = ({ data: { id, url } }) => {
  queue.push({ id, url })
  drainQueue()
}
