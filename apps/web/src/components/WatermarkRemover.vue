<script setup lang="ts">
import { ref } from 'vue'

const imageFile = ref<File | null>(null)
const imagePreview = ref<string | null>(null)
const processedImage = ref<string | null>(null)
const isProcessing = ref(false)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const isDrawing = ref(false)
const ctx = ref<CanvasRenderingContext2D | null>(null)
const maskCanvas = ref<HTMLCanvasElement | null>(null)
const maskCtx = ref<CanvasRenderingContext2D | null>(null)
const imageCanvas = ref<HTMLCanvasElement | null>(null)

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    imageFile.value = target.files[0]
    const reader = new FileReader()
    reader.onload = (e) => {
      imagePreview.value = e.target?.result as string
      processedImage.value = null
      initCanvas()
    }
    reader.readAsDataURL(target.files[0])
  }
}

function initCanvas() {
  if (!imagePreview.value) return
  setTimeout(() => {
    const canvas = canvasRef.value
    if (!canvas) return
    const img = new Image()
    img.onload = () => {
      const maxWidth = 800
      let width = img.width
      let height = img.height
      if (width > maxWidth) {
        height = (maxWidth / width) * height
        width = maxWidth
      }
      canvas.width = width
      canvas.height = height
      ctx.value = canvas.getContext('2d')
      if (ctx.value) {
        ctx.value.drawImage(img, 0, 0, width, height)
        ctx.value.strokeStyle = 'rgba(255, 0, 0, 0.5)'
        ctx.value.lineWidth = 20
        ctx.value.lineJoin = 'round'
        ctx.value.lineCap = 'round'
      }

      // 干净的缩放图片（无笔触标记），与 mask 尺寸一致
      const iCanvas = document.createElement('canvas')
      iCanvas.width = width
      iCanvas.height = height
      const iCtx = iCanvas.getContext('2d')
      if (iCtx) {
        iCtx.drawImage(img, 0, 0, width, height)
      }
      imageCanvas.value = iCanvas

      // 蒙版画布：黑底，白色笔触标记水印区域
      const mCanvas = document.createElement('canvas')
      mCanvas.width = width
      mCanvas.height = height
      maskCanvas.value = mCanvas
      maskCtx.value = mCanvas.getContext('2d')
      if (maskCtx.value) {
        maskCtx.value.fillStyle = 'black'
        maskCtx.value.fillRect(0, 0, width, height)
        maskCtx.value.strokeStyle = 'white'
        maskCtx.value.lineWidth = 20
        maskCtx.value.lineJoin = 'round'
        maskCtx.value.lineCap = 'round'
      }
    }
    img.src = imagePreview.value!
  }, 100)
}

function startDrawing(e: MouseEvent | TouchEvent) {
  isDrawing.value = true
  draw(e)
}

function stopDrawing() {
  isDrawing.value = false
  if (ctx.value) ctx.value.beginPath()
  if (maskCtx.value) maskCtx.value.beginPath()
}

function draw(e: MouseEvent | TouchEvent) {
  if (!isDrawing.value || !ctx.value || !canvasRef.value) return

  const rect = canvasRef.value.getBoundingClientRect()
  const x = (e instanceof MouseEvent ? e.clientX : e?.touches?.[0]?.clientX ?? 0) - rect.left
  const y = (e instanceof MouseEvent ? e.clientY : e?.touches?.[0]?.clientY ?? 0) - rect.top

  // 在主画布上绘制（可见的红色笔触）
  ctx.value.lineTo(x, y)
  ctx.value.stroke()
  ctx.value.beginPath()
  ctx.value.moveTo(x, y)

  // 在蒙版画布上绘制（隐藏的白色笔触）
  if (maskCtx.value) {
    maskCtx.value.lineTo(x, y)
    maskCtx.value.stroke()
    maskCtx.value.beginPath()
    maskCtx.value.moveTo(x, y)
  }
}

function getImageData(): string {
  if (!imageCanvas.value) return ''
  return imageCanvas.value.toDataURL('image/png')
}

function getMaskData(): string {
  if (!maskCanvas.value) return ''
  return maskCanvas.value.toDataURL('image/png')
}

async function removeWatermark() {
  if (!imagePreview.value) return
  isProcessing.value = true

  try {
    const response = await fetch('/api/watermark/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: getImageData(),
        mask: getMaskData(),
      }),
    })

    if (!response.ok) {
      console.error(`Server error: ${response.status}`)
      return
    }

    const result = await response.json()
    if (result.success) {
      processedImage.value = result.data.image
    }
    else {
      console.error('Error: ', result.message)
    }
  }
  catch (err) {
    console.error(err)
  }
  finally {
    isProcessing.value = false
  }
}

const isDownloading = ref(false)

function downloadImage() {
  if (!processedImage.value) return
  isDownloading.value = true

  try {
    const dataUri = processedImage.value
    const match = dataUri.match(/^data:(image\/[a-z]+);base64,/)
    const mime = match ? match[1] : ''
    const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'png'

    const link = document.createElement('a')
    link.href = dataUri
    link.download = `watermark-removed-${Date.now()}.${ext}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  catch (err) {
    console.error('Download failed:', err)
  }
  finally {
    isDownloading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-[900px] flex flex-col gap-8">
    <!-- Main Card -->
    <div class="glass-card min-h-[400px] flex flex-col justify-center">
      <!-- Upload Zone -->
      <div
        v-if="!imagePreview"
        class="border-2 border-dashed border-glass-border rounded-2xl transition-all duration-300 hover:border-primary hover:bg-primary/5"
      >
        <label for="file-upload" class="flex flex-col items-center gap-4 p-16 cursor-pointer">
          <div class="text-5xl">📸</div>
          <span>Select or Drag Image</span>
          <input id="file-upload" type="file" accept="image/*" hidden @change="handleFileUpload">
        </label>
      </div>

      <!-- Editor Zone -->
      <div v-else class="flex flex-col items-center gap-6">
        <div class="relative rounded-xl overflow-hidden shadow-[0_10px_25px_rgba(0,0,0,0.5)]">
          <canvas
            ref="canvasRef"
            class="block cursor-crosshair"
            @mousedown="startDrawing"
            @mousemove="draw"
            @mouseup="stopDrawing"
            @mouseleave="stopDrawing"
            @touchstart="startDrawing"
            @touchmove="draw"
            @touchend="stopDrawing"
          />
          <div
            class="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded-full text-xs pointer-events-none"
          >
            Draw over the watermark to remove it
          </div>
        </div>

        <div class="flex gap-4">
          <button class="btn-secondary" @click="imagePreview = null">
            Reset
          </button>
          <button
            :disabled="isProcessing"
            class="btn-primary flex items-center"
            @click="removeWatermark"
          >
            <span
              v-if="isProcessing"
              class="inline-block w-4 h-4 border-2 border-white/30 rounded-full border-t-white animate-spin mr-2"
            />
            {{ isProcessing ? 'Removing...' : 'Remove Watermark' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Result Card -->
    <div v-if="processedImage" class="glass-card text-center animate-fade-in">
      <h3 class="text-xl font-semibold mb-4">
        Result
      </h3>
      <img :src="processedImage" alt="Result" class="max-w-full rounded-xl my-6">
      <button
        :disabled="isDownloading"
        class="btn-primary flex items-center justify-center mx-auto"
        @click="downloadImage"
      >
        <span
          v-if="isDownloading"
          class="inline-block w-4 h-4 border-2 border-white/30 rounded-full border-t-white animate-spin mr-2"
        />
        <span v-else class="mr-2">⬇️</span>
        {{ isDownloading ? 'Downloading...' : 'Download Image' }}
      </button>
    </div>
  </div>
</template>
