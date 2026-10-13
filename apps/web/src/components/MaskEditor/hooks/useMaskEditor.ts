import type { PointerEvent } from 'react'
import type { Region, Stroke } from '@/types/mask'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getCanvasPoint } from '@/utils/canvas'

export function useMaskEditor(imageDataUrl: string) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageCanvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const strokes = useRef<Stroke[]>([])
  const currentStroke = useRef<Stroke | null>(null)
  const pointerId = useRef<number | null>(null)
  const [brushSize, setBrushSize] = useState([24])
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [showToolbar, setShowToolbar] = useState(true)
  const [hasMaskStrokes, setHasMaskStrokes] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })

  const redrawMask = useCallback(() => {
    const canvas = maskCanvasRef.current
    const img = imageRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !img) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const scaleX = canvas.width / img.width
    const scaleY = canvas.height / img.height
    const allStrokes = currentStroke.current
      ? [...strokes.current, currentStroke.current]
      : strokes.current
    for (const stroke of allStrokes) {
      if (!stroke.points.length) continue
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)'
      ctx.fillStyle = ctx.strokeStyle
      ctx.lineWidth = stroke.brushSize * scaleX
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      const first = stroke.points[0]
      if (stroke.points.length === 1) {
        ctx.arc(first.x * scaleX, first.y * scaleY, ctx.lineWidth / 2, 0, Math.PI * 2)
        ctx.fill()
      }
      else {
        ctx.moveTo(first.x * scaleX, first.y * scaleY)
        for (const point of stroke.points.slice(1)) ctx.lineTo(point.x * scaleX, point.y * scaleY)
        ctx.stroke()
      }
    }
  }, [])

  useEffect(() => {
    let active = true
    strokes.current = []
    currentStroke.current = null
    pointerId.current = null
    imageRef.current = null
    setHasMaskStrokes(false)
    setIsDrawing(false)
    const img = new Image()
    function resizeAndDraw() {
      const width = containerRef.current?.clientWidth
      if (!active || !imageRef.current || !width) return
      const maxHeight = Math.min(window.innerHeight * 0.54, 560)
      const scale = Math.min(width / img.width, maxHeight / img.height)
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      setCanvasSize({ width: w, height: h })
      const imageCanvas = imageCanvasRef.current
      const maskCanvas = maskCanvasRef.current
      if (imageCanvas) {
        imageCanvas.width = w
        imageCanvas.height = h
        imageCanvas.getContext('2d')?.drawImage(img, 0, 0, w, h)
      }
      if (maskCanvas) {
        maskCanvas.width = w
        maskCanvas.height = h
      }
      redrawMask()
    }
    img.onload = () => {
      if (!active) return
      imageRef.current = img
      resizeAndDraw()
    }
    img.src = imageDataUrl
    const observer = new ResizeObserver(resizeAndDraw)
    if (containerRef.current) observer.observe(containerRef.current)
    window.addEventListener('resize', resizeAndDraw)
    return () => {
      active = false
      img.onload = null
      observer.disconnect()
      window.removeEventListener('resize', resizeAndDraw)
    }
  }, [imageDataUrl, redrawMask])

  function imagePoint(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = maskCanvasRef.current
    const img = imageRef.current
    if (!canvas || !img || !canvas.width || !canvas.height) return null
    const point = getCanvasPoint(e.nativeEvent, canvas)
    if (!point) return null
    setCursor(point)
    return {
      x: Math.max(0, Math.min(img.width, (point.x * img.width) / canvas.width)),
      y: Math.max(0, Math.min(img.height, (point.y * img.height) / canvas.height)),
    }
  }
  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (pointerId.current !== null || (e.pointerType === 'mouse' && e.button !== 0)) return
    const point = imagePoint(e)
    const img = imageRef.current
    const canvas = maskCanvasRef.current
    if (!point || !img || !canvas) return
    e.preventDefault()
    canvas.setPointerCapture(e.pointerId)
    pointerId.current = e.pointerId
    currentStroke.current = {
      points: [point],
      brushSize: (brushSize[0] * img.width) / canvas.width,
    }
    setIsDrawing(true)
    redrawMask()
  }
  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (pointerId.current !== null && pointerId.current !== e.pointerId) return
    const point = imagePoint(e)
    if (!point || !currentStroke.current) return
    currentStroke.current.points.push(point)
    redrawMask()
  }
  function handlePointerUp(e: PointerEvent<HTMLCanvasElement>) {
    if (pointerId.current !== e.pointerId) return
    if (currentStroke.current) strokes.current.push(currentStroke.current)
    currentStroke.current = null
    pointerId.current = null
    setIsDrawing(false)
    setHasMaskStrokes(strokes.current.length > 0)
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
    redrawMask()
  }
  function handleUndo() {
    strokes.current.pop()
    setHasMaskStrokes(strokes.current.length > 0)
    redrawMask()
  }
  function handleClear() {
    strokes.current = []
    currentStroke.current = null
    setHasMaskStrokes(false)
    redrawMask()
  }
  const getRegion = useCallback((): Region | null => {
    const img = imageRef.current
    if (!img || !strokes.current.length) return null
    let left = img.width
    let top = img.height
    let right = 0
    let bottom = 0
    for (const stroke of strokes.current) {
      const radius = stroke.brushSize / 2
      for (const point of stroke.points) {
        left = Math.min(left, point.x - radius)
        top = Math.min(top, point.y - radius)
        right = Math.max(right, point.x + radius)
        bottom = Math.max(bottom, point.y + radius)
      }
    }
    const x1 = Math.max(0, Math.min(998, Math.floor((left / img.width) * 999)))
    const y1 = Math.max(0, Math.min(998, Math.floor((top / img.height) * 999)))
    return {
      x1,
      y1,
      x2: Math.max(x1 + 1, Math.min(999, Math.ceil((right / img.width) * 999))),
      y2: Math.max(y1 + 1, Math.min(999, Math.ceil((bottom / img.height) * 999))),
    }
  }, [])
  return {
    containerRef,
    imageCanvasRef,
    maskCanvasRef,
    brushSize,
    setBrushSize,
    canvasSize,
    showToolbar,
    setShowToolbar,
    hasMaskStrokes,
    isDrawing,
    isHovering,
    setIsHovering,
    cursor,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleUndo,
    handleClear,
    getRegion,
  }
}
