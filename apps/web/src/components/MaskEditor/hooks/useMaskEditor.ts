import type { Ref } from 'vue'
import type { Stroke } from '@/types/mask'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { getCanvasPoint } from '@/utils/canvas'

interface MaskEditorRefs {
  containerRef: Ref<HTMLDivElement | null>
  imageCanvasRef: Ref<HTMLCanvasElement | null>
  maskCanvasRef: Ref<HTMLCanvasElement | null>
}

export function useMaskEditor(
  props: { imageDataUrl: string },
  refs: MaskEditorRefs,
) {
  const { containerRef, imageCanvasRef, maskCanvasRef } = refs

  const brushSize = ref([24])
  const isDrawing = ref(false)
  const strokes = ref<Stroke[]>([])
  const currentStroke = ref<Stroke | null>(null)
  const canvasSize = ref({ width: 0, height: 0 })
  const imageLoaded = ref(false)
  const showToolbar = ref(true)
  const imageEl = ref<HTMLImageElement | null>(null)
  const scaleValue = ref(1)

  const cursorX = ref(0)
  const cursorY = ref(0)
  const isHovering = ref(false)

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

    const maskCanvas = maskCanvasRef.value
    if (maskCanvas) {
      maskCanvas.width = w
      maskCanvas.height = h
    }

    strokes.value = []
    currentStroke.value = null
  }

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
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)'
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

  watch([strokes, currentStroke], () => {
    redrawMask()
  }, { deep: true })

  function handlePointerDown(e: MouseEvent | TouchEvent) {
    e.preventDefault()
    const canvas = maskCanvasRef.value
    if (!canvas) return
    const point = getCanvasPoint(e, canvas)
    if (!point) return
    isDrawing.value = true
    currentStroke.value = { points: [point], brushSize: brushSize.value[0] }
  }

  function handlePointerEnter() {
    isHovering.value = true
  }

  function handlePointerLeave() {
    isHovering.value = false
    handlePointerUp()
  }

  function handlePointerMove(e: MouseEvent | TouchEvent) {
    const canvas = maskCanvasRef.value
    if (!canvas) return
    const point = getCanvasPoint(e, canvas)
    if (!point) return

    cursorX.value = point.x
    cursorY.value = point.y

    if (!isDrawing.value || !currentStroke.value) return
    e.preventDefault()
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

  function getMaskDataUrl(): string | null {
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

  return {
    brushSize,
    isDrawing,
    canvasSize,
    imageLoaded,
    showToolbar,
    cursorX,
    cursorY,
    isHovering,
    hasMaskStrokes,
    handlePointerDown,
    handlePointerEnter,
    handlePointerLeave,
    handlePointerMove,
    handlePointerUp,
    handleUndo,
    handleClear,
    getMaskDataUrl,
    hasMask,
  }
}
