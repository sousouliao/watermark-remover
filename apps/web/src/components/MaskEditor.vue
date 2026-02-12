<script setup lang="ts">
import { Minus, Paintbrush, Plus, Trash2, Undo2 } from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

interface Stroke {
  points: { x: number, y: number }[]
  brushSize: number
}

const props = defineProps<{
  imageDataUrl: string
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const imageCanvasRef = ref<HTMLCanvasElement | null>(null)
const maskCanvasRef = ref<HTMLCanvasElement | null>(null)

const brushSize = ref([24])
const isDrawing = ref(false)
const strokes = ref<Stroke[]>([])
const currentStroke = ref<Stroke | null>(null)
const canvasSize = ref({ width: 0, height: 0 })
const imageLoaded = ref(false)
const showToolbar = ref(true)
const imageEl = ref<HTMLImageElement | null>(null)
const scaleValue = ref(1)

// Load image
function loadImage() {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    imageEl.value = img
    imageLoaded.value = true
    nextTick(() => resizeAndDraw())
  }
  img.src = props.imageDataUrl
}

// Resize and draw
function resizeAndDraw() {
  if (!imageEl.value || !containerRef.value) return

  const img = imageEl.value
  const containerWidth = containerRef.value.clientWidth
  const maxHeight = Math.min(window.innerHeight * 0.55, 500)

  const scale = Math.min(containerWidth / img.width, maxHeight / img.height, 1)
  scaleValue.value = scale

  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  canvasSize.value = { width: w, height: h }

  // Draw image on image canvas
  const imageCanvas = imageCanvasRef.value
  if (imageCanvas) {
    imageCanvas.width = w
    imageCanvas.height = h
    const ctx = imageCanvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
    }
  }

  // Setup mask canvas
  const maskCanvas = maskCanvasRef.value
  if (maskCanvas) {
    maskCanvas.width = w
    maskCanvas.height = h
  }

  // Clear strokes on resize since coordinates change
  strokes.value = []
  currentStroke.value = null
}

// Redraw mask
function redrawMask() {
  const canvas = maskCanvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const allStrokes = currentStroke.value
    ? [...strokes.value, currentStroke.value]
    : strokes.value

  for (const stroke of allStrokes) {
    if (stroke.points.length < 2) continue
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)'
    ctx.lineWidth = stroke.brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
    }
    ctx.stroke()
  }
}

// Watch strokes for redraw
watch([strokes, currentStroke], () => {
  redrawMask()
}, { deep: true })

// Canvas point calculation
function getCanvasPoint(e: MouseEvent | TouchEvent) {
  const canvas = maskCanvasRef.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  let clientX: number, clientY: number
  if ('touches' in e) {
    clientX = e.touches[0].clientX
    clientY = e.touches[0].clientY
  }
  else {
    clientX = e.clientX
    clientY = e.clientY
  }
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  }
}

function handlePointerDown(e: MouseEvent | TouchEvent) {
  e.preventDefault()
  const point = getCanvasPoint(e)
  if (!point) return
  isDrawing.value = true
  currentStroke.value = { points: [point], brushSize: brushSize.value[0] }
}

function handlePointerMove(e: MouseEvent | TouchEvent) {
  if (!isDrawing.value || !currentStroke.value) return
  e.preventDefault()
  const point = getCanvasPoint(e)
  if (!point) return
  currentStroke.value = {
    ...currentStroke.value,
    points: [...currentStroke.value.points, point],
  }
}

function handlePointerUp() {
  if (currentStroke.value && currentStroke.value.points.length > 1) {
    strokes.value = [...strokes.value, currentStroke.value]
  }
  currentStroke.value = null
  isDrawing.value = false
}

function handleUndo() {
  strokes.value = strokes.value.slice(0, -1)
}

function handleClear() {
  strokes.value = []
  currentStroke.value = null
}

// Expose mask data to parent
function getMaskDataUrl() {
  if (!imageEl.value) return null
  const img = imageEl.value
  const offscreen = document.createElement('canvas')
  offscreen.width = img.width
  offscreen.height = img.height
  const ctx = offscreen.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, offscreen.width, offscreen.height)

  const scale = scaleValue.value
  for (const stroke of strokes.value) {
    if (stroke.points.length < 2) continue
    ctx.beginPath()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = stroke.brushSize / scale
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.moveTo(stroke.points[0].x / scale, stroke.points[0].y / scale)
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x / scale, stroke.points[i].y / scale)
    }
    ctx.stroke()
  }
  return offscreen.toDataURL('image/png')
}

const hasMask = () => strokes.value.length > 0

defineExpose({ getMaskDataUrl, hasMask })

watch(() => props.imageDataUrl, () => {
  imageLoaded.value = false
  strokes.value = []
  currentStroke.value = null
  loadImage()
})

onMounted(() => {
  loadImage()

  const observer = new ResizeObserver(() => {
    if (imageEl.value && containerRef.value) {
      resizeAndDraw()
    }
  })
  if (containerRef.value) {
    observer.observe(containerRef.value)
  }

  onUnmounted(() => observer.disconnect())
})

const hasMaskStrokes = computed(() => strokes.value.length > 0)
</script>

<template>
  <div class="animate-fade-in flex flex-col gap-3">
    <!-- Compact toggle for mobile -->
    <div class="flex items-center justify-between md:hidden">
      <Button
        variant="ghost"
        size="sm"
        class="text-xs text-muted-foreground"
        :aria-expanded="showToolbar"
        aria-controls="mask-toolbar"
        @click="showToolbar = !showToolbar"
      >
        <Paintbrush class="mr-1.5 h-3.5 w-3.5" />
        Brush Tools
      </Button>
    </div>

    <!-- Toolbar -->
    <div
      id="mask-toolbar"
      :class="cn(
        'glass-card rounded-2xl p-3 transition-all',
        showToolbar ? 'block' : 'hidden md:block',
      )"
    >
      <div class="flex items-center gap-4">
        <!-- Brush preview + size control group -->
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <!-- Live brush preview circle -->
          <button
            type="button"
            class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/60 transition-colors hover:bg-secondary"
            :aria-label="`Current brush size: ${brushSize[0]}px`"
            tabindex="-1"
          >
            <span
              class="rounded-full bg-red-500/50 transition-all duration-150"
              :style="{
                width: `${Math.max(6, Math.min(brushSize[0] * 0.6, 28))}px`,
                height: `${Math.max(6, Math.min(brushSize[0] * 0.6, 28))}px`,
              }"
            />
          </button>

          <!-- Slider with buttons -->
          <div class="flex flex-1 items-center gap-2 min-w-0">
            <button
              type="button"
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Decrease brush size"
              @click="brushSize = [Math.max(4, brushSize[0] - 4)]"
            >
              <Minus class="h-3 w-3" />
            </button>

            <div class="relative flex-1 min-w-[80px]">
              <Slider
                v-model="brushSize"
                :min="4"
                :max="60"
                :step="2"
                class="flex-1"
                aria-label="Brush size"
              />
            </div>

            <button
              type="button"
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Increase brush size"
              @click="brushSize = [Math.min(60, brushSize[0] + 4)]"
            >
              <Plus class="h-3 w-3" />
            </button>

            <span class="min-w-[36px] shrink-0 text-center font-mono text-xs tabular-nums text-foreground/70">
              {{ brushSize[0] }}px
            </span>
          </div>
        </div>

        <!-- Divider -->
        <div class="hidden h-6 w-px bg-border md:block" />

        <!-- Actions -->
        <div class="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            :disabled="!hasMaskStrokes"
            aria-label="Undo last stroke"
            class="h-8 gap-1.5 rounded-lg border-border bg-secondary/50 px-2.5 text-xs text-foreground hover:bg-secondary hover:text-foreground"
            @click="handleUndo"
          >
            <Undo2 class="h-3.5 w-3.5" />
            <span class="hidden sm:inline">Undo</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="!hasMaskStrokes"
            aria-label="Clear all masks"
            class="h-8 gap-1.5 rounded-lg border-destructive/40 bg-destructive/10 px-2.5 text-xs text-destructive hover:border-destructive/60 hover:bg-destructive/20 hover:text-destructive"
            @click="handleClear"
          >
            <Trash2 class="h-3.5 w-3.5" />
            <span class="hidden sm:inline">Clear</span>
          </Button>
        </div>
      </div>

      <!-- Hint text -->
      <p class="mt-2 text-[11px] text-muted-foreground/60 hidden md:block">
        Paint over the watermark you want to remove
      </p>
    </div>

    <!-- Canvas area -->
    <div
      ref="containerRef"
      class="glass-card relative overflow-hidden rounded-2xl"
    >
      <div
        class="relative mx-auto"
        :style="{
          width: canvasSize.width ? `${canvasSize.width}px` : '100%',
          height: canvasSize.height ? `${canvasSize.height}px` : '300px',
        }"
      >
        <canvas
          ref="imageCanvasRef"
          class="absolute inset-0"
          :style="{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }"
        />
        <canvas
          ref="maskCanvasRef"
          class="absolute inset-0 cursor-crosshair touch-none"
          :style="{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }"
          aria-label="Mask drawing canvas. Use your mouse or finger to paint over the watermark."
          role="img"
          @mousedown="handlePointerDown"
          @mousemove="handlePointerMove"
          @mouseup="handlePointerUp"
          @mouseleave="handlePointerUp"
          @touchstart.prevent="handlePointerDown"
          @touchmove.prevent="handlePointerMove"
          @touchend.prevent="handlePointerUp"
        />
      </div>

      <!-- Hint overlay when no strokes -->
      <div
        v-if="strokes.length === 0 && !isDrawing"
        class="pointer-events-none absolute inset-0 flex items-end justify-center pb-4"
      >
        <div class="rounded-full bg-foreground/70 px-3 py-1.5 text-xs font-medium text-background backdrop-blur-sm">
          Paint over the watermark you want to remove
        </div>
      </div>
    </div>
  </div>
</template>
