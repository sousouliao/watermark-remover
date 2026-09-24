import type { Ref } from 'vue'
import type { Point, Region, Stroke } from '@/types/mask'
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
  const showToolbar = ref(true)
  const imageEl = ref<HTMLImageElement | null>(null)
  let resizeObserver: ResizeObserver | null = null

  const cursorX = ref(0)
  const cursorY = ref(0)
  const isHovering = ref(false)

  function loadImage() {
    strokes.value = []
    currentStroke.value = null
    imageEl.value = null
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const imageUrl = props.imageDataUrl
    img.onload = () => {
      if (props.imageDataUrl !== imageUrl) return
      imageEl.value = img
      nextTick(() => resizeAndDraw())
    }
    img.src = imageUrl
  }

  function resizeAndDraw() {
    if (!imageEl.value || !containerRef.value) return

    const img = imageEl.value
    const containerWidth = containerRef.value.clientWidth
    if (!containerWidth) return
    const maxHeight = Math.min(window.innerHeight * 0.55, 500)

    const scale = Math.min(containerWidth / img.width, maxHeight / img.height, 1)

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
    redrawMask()
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

    const img = imageEl.value
    if (!img) return
    const scaleX = canvas.width / img.width
    const scaleY = canvas.height / img.height

    for (const stroke of allStrokes) {
      if (!stroke.points.length) continue
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)'
      ctx.lineWidth = stroke.brushSize * scaleX
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY)
      if (stroke.points.length === 1) {
        ctx.arc(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY, ctx.lineWidth / 2, 0, Math.PI * 2)
        ctx.fillStyle = ctx.strokeStyle
        ctx.fill()
        continue
      }
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * scaleX, stroke.points[i].y * scaleY)
      }
      ctx.stroke()
    }
  }

  function toImagePoint(point: Point): Point | null {
    const img = imageEl.value
    const { width, height } = canvasSize.value
    if (!img || !width || !height) return null
    return {
      x: Math.max(0, Math.min(img.width, point.x * img.width / width)),
      y: Math.max(0, Math.min(img.height, point.y * img.height / height)),
    }
  }

  watch([strokes, currentStroke], () => {
    redrawMask()
  }, { deep: true })

  function handlePointerDown(e: MouseEvent | TouchEvent) {
    e.preventDefault()
    const canvas = maskCanvasRef.value
    if (!canvas) return
    const displayPoint = getCanvasPoint(e, canvas)
    const point = displayPoint && toImagePoint(displayPoint)
    const img = imageEl.value
    if (!point || !img) return
    isDrawing.value = true
    currentStroke.value = {
      points: [point],
      brushSize: brushSize.value[0] * img.width / canvasSize.value.width,
    }
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
    const displayPoint = getCanvasPoint(e, canvas)
    if (!displayPoint) return

    cursorX.value = displayPoint.x
    cursorY.value = displayPoint.y

    if (!isDrawing.value || !currentStroke.value) return
    const point = toImagePoint(displayPoint)
    if (!point) return
    e.preventDefault()
    currentStroke.value = {
      ...currentStroke.value,
      points: [...currentStroke.value.points, point],
    }
  }

  function handlePointerUp() {
    if (currentStroke.value) {
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

  function getRegion(): Region | null {
    const img = imageEl.value
    if (!img || !strokes.value.length) return null

    let left = img.width
    let top = img.height
    let right = 0
    let bottom = 0
    for (const stroke of strokes.value) {
      const radius = stroke.brushSize / 2
      for (const point of stroke.points) {
        left = Math.min(left, point.x - radius)
        top = Math.min(top, point.y - radius)
        right = Math.max(right, point.x + radius)
        bottom = Math.max(bottom, point.y + radius)
      }
    }

    const x1 = Math.max(0, Math.floor(left / img.width * 999))
    const y1 = Math.max(0, Math.floor(top / img.height * 999))
    const x2 = Math.min(999, Math.ceil(right / img.width * 999))
    const y2 = Math.min(999, Math.ceil(bottom / img.height * 999))
    return { x1, y1, x2: Math.max(x1 + 1, x2), y2: Math.max(y1 + 1, y2) }
  }

  watch(() => props.imageDataUrl, () => {
    loadImage()
  })

  onMounted(() => {
    loadImage()

    resizeObserver = new ResizeObserver(() => {
      if (imageEl.value && containerRef.value) {
        resizeAndDraw()
      }
    })
    if (containerRef.value) {
      resizeObserver.observe(containerRef.value)
    }
  })

  onUnmounted(() => resizeObserver?.disconnect())

  const hasMaskStrokes = computed(() => strokes.value.length > 0)

  return {
    brushSize,
    isDrawing,
    canvasSize,
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
    getRegion,
  }
}
