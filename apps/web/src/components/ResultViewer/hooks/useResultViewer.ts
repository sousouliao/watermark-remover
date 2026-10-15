import type { KeyboardEvent, PointerEvent } from 'react'
import type { ViewMode } from '@/types/app'
import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'

export function useResultViewer({
  originalUrl,
  resultUrl,
  onResultChange,
}: {
  originalUrl: string
  resultUrl: string
  onResultChange: (url: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('slider')
  const [sliderPosition, setSliderPosition] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const [aspectRatio, setAspectRatio] = useState(16 / 9)
  const [isUpscaling, setIsUpscaling] = useState(false)
  const [isUpscaled, setIsUpscaled] = useState(false)
  const [upscaleError, setUpscaleError] = useState<string | null>(null)
  const preUpscaleUrl = useRef<string | null>(null)
  const upscaledUrl = useRef<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const drag = useRef<{
    pointerId: number | null
    pct: number
    raf: number
    pendingX: number | null
  }>({ pointerId: null, pct: 50, raf: 0, pendingX: null })

  useEffect(() => {
    const img = new Image()
    img.onload = () => setAspectRatio(img.width / img.height)
    img.src = originalUrl
    return () => {
      img.onload = null
    }
  }, [originalUrl])
  useEffect(
    () => () => {
      controllerRef.current?.abort()
      cancelAnimationFrame(drag.current.raf)
    },
    [],
  )
  useEffect(() => {
    containerRef.current?.style.setProperty('--slider-pct', String(sliderPosition))
  }, [viewMode, sliderPosition])

  function setPosition(pct: number) {
    drag.current.pct = Math.max(0, Math.min(100, pct))
    containerRef.current?.style.setProperty('--slider-pct', String(drag.current.pct))
    containerRef.current?.setAttribute('aria-valuenow', String(Math.round(drag.current.pct)))
  }
  function updatePosition(clientX: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect?.width) setPosition(((clientX - rect.left) / rect.width) * 100)
  }
  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (drag.current.pointerId !== null || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.preventDefault()
    e.currentTarget.focus()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current.pointerId = e.pointerId
    setIsDragging(true)
    updatePosition(e.clientX)
  }
  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (drag.current.pointerId !== e.pointerId) return
    drag.current.pendingX = e.clientX
    if (!drag.current.raf) {
      drag.current.raf = requestAnimationFrame(() => {
        drag.current.raf = 0
        if (drag.current.pendingX !== null) updatePosition(drag.current.pendingX)
        drag.current.pendingX = null
      })
    }
  }
  function handlePointerUp(e: PointerEvent<HTMLDivElement>) {
    if (drag.current.pointerId !== e.pointerId) return
    cancelAnimationFrame(drag.current.raf)
    drag.current.raf = 0
    if (drag.current.pendingX !== null) updatePosition(drag.current.pendingX)
    drag.current.pendingX = null
    drag.current.pointerId = null
    setSliderPosition(drag.current.pct)
    setIsDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
  }
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    setPosition(
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? 100
          : drag.current.pct + (e.key === 'ArrowLeft' ? -2 : 2),
    )
    setSliderPosition(drag.current.pct)
  }
  function handleDownload() {
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = `${isUpscaled ? 'upscaled' : 'watermark-removed'}-${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  async function handleUpscale() {
    if (controllerRef.current || isUpscaled) return
    preUpscaleUrl.current = resultUrl
    setUpscaleError(null)
    if (upscaledUrl.current) {
      onResultChange(upscaledUrl.current)
      setIsUpscaled(true)
      return
    }
    const controller = new AbortController()
    controllerRef.current = controller
    setIsUpscaling(true)
    try {
      const response = await apiFetch('/api/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: resultUrl, scale: 2 }),
        signal: controller.signal,
      })
      const result = await response.json()
      if (controller.signal.aborted) return
      if (!response.ok || !result.success || !result.data?.image?.startsWith('data:image/'))
        throw new Error('Invalid enhancement result')
      upscaledUrl.current = result.data.image
      onResultChange(result.data.image)
      setIsUpscaled(true)
    }
    catch {
      if (controller.signal.aborted) return
      setUpscaleError('增强失败，请重试。')
      preUpscaleUrl.current = null
    }
    finally {
      if (controllerRef.current === controller) controllerRef.current = null
      if (!controller.signal.aborted) setIsUpscaling(false)
    }
  }
  function handleRevertUpscale() {
    if (!preUpscaleUrl.current) return
    onResultChange(preUpscaleUrl.current)
    setIsUpscaled(false)
  }
  return {
    containerRef,
    viewMode,
    setViewMode,
    sliderPosition,
    isDragging,
    aspectRatio,
    isUpscaling,
    isUpscaled,
    upscaleError,
    setUpscaleError,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown,
    handleDownload,
    handleUpscale,
    handleRevertUpscale,
  }
}
