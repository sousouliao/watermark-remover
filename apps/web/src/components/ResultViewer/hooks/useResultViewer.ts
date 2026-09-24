import type { Ref } from 'vue'
import type { ViewMode } from '@/types/app'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

export function useResultViewer(
  props: { originalUrl: string, resultUrl: string },
  containerRef: Ref<HTMLDivElement | null>,
  emit: (event: 'update:resultUrl', url: string) => void,
) {
  const viewMode = ref<ViewMode>('slider')
  const sliderPosition = ref(50)
  const isDragging = ref(false)
  const imageSize = ref({ width: 0, height: 0 })

  // Upscale 状态
  const isUpscaling = ref(false)
  const isUpscaled = ref(false)
  const upscaleError = ref<string | null>(null)
  const preUpscaleUrl = ref<string | null>(null)
  const upscaledUrl = ref<string | null>(null)
  let upscaleController: AbortController | null = null

  let rafId = 0
  let pendingClientX: number | null = null
  let lastPct = 50

  onMounted(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageSize.value = { width: img.width, height: img.height }
    }
    img.src = props.originalUrl
  })

  const aspectRatio = computed(() => {
    if (imageSize.value.width && imageSize.value.height) {
      return imageSize.value.width / imageSize.value.height
    }
    return 16 / 9
  })

  function updateSliderFromClientX(clientX: number) {
    if (!containerRef.value) return
    const rect = containerRef.value.getBoundingClientRect()
    const x = clientX - rect.left
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100))
    lastPct = pct
    containerRef.value.style.setProperty('--slider-pct', String(pct))
  }

  function tick() {
    rafId = 0
    if (pendingClientX === null) return
    const x = pendingClientX
    pendingClientX = null
    updateSliderFromClientX(x)
  }

  function syncSliderPositionToRef() {
    sliderPosition.value = lastPct
  }

  function setSliderPctFromRef() {
    if (containerRef.value) {
      lastPct = sliderPosition.value
      containerRef.value.style.setProperty('--slider-pct', String(sliderPosition.value))
    }
  }

  function handleMouseDown(e: MouseEvent) {
    e.preventDefault()
    isDragging.value = true
    updateSliderFromClientX(e.clientX)
  }

  function handleTouchStart(e: TouchEvent) {
    isDragging.value = true
    updateSliderFromClientX(e.touches[0].clientX)
  }

  function handleMove(e: MouseEvent | TouchEvent) {
    if (!isDragging.value) return
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
    pendingClientX = clientX
    if (rafId === 0) rafId = requestAnimationFrame(tick)
  }

  function handleUp() {
    isDragging.value = false
    syncSliderPositionToRef()
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') sliderPosition.value = Math.max(0, sliderPosition.value - 2)
    if (e.key === 'ArrowRight') sliderPosition.value = Math.min(100, sliderPosition.value + 2)
    setSliderPctFromRef()
  }

  onMounted(() => {
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchmove', handleMove, { passive: true })
    window.addEventListener('touchend', handleUp)
  })

  onUnmounted(() => {
    upscaleController?.abort()
    window.removeEventListener('mousemove', handleMove)
    window.removeEventListener('mouseup', handleUp)
    window.removeEventListener('touchmove', handleMove)
    window.removeEventListener('touchend', handleUp)
    if (rafId !== 0) cancelAnimationFrame(rafId)
  })

  function handleDownload() {
    const a = document.createElement('a')
    a.href = props.resultUrl
    const prefix = isUpscaled.value ? 'upscaled' : 'watermark-removed'
    a.download = `${prefix}-${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function handleUpscale() {
    if (isUpscaling.value || isUpscaled.value) return

    // 缓存命中：直接使用之前增强过的结果，秒切换
    if (upscaledUrl.value) {
      preUpscaleUrl.value = props.resultUrl
      emit('update:resultUrl', upscaledUrl.value)
      isUpscaled.value = true
      return
    }

    isUpscaling.value = true
    upscaleError.value = null
    const controller = new AbortController()
    upscaleController = controller

    // 保存增强前的图片，以便回退
    preUpscaleUrl.value = props.resultUrl

    try {
      const response = await fetch('/api/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          image: props.resultUrl,
          scale: 2,
        }),
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      const result = await response.json()
      if (controller.signal.aborted) return
      if (result.success) {
        upscaledUrl.value = result.data.image // 缓存增强结果
        emit('update:resultUrl', result.data.image)
        isUpscaled.value = true
      }
      else {
        throw new Error(result.message || 'Unknown server error')
      }
    }
    catch (err) {
      if (controller.signal.aborted) return
      console.error('Upscale failed:', err)
      upscaleError.value = 'Enhancement failed. Please try again.'
      preUpscaleUrl.value = null
    }
    finally {
      if (upscaleController === controller) upscaleController = null
      isUpscaling.value = false
    }
  }

  function handleRevertUpscale() {
    if (!preUpscaleUrl.value) return
    emit('update:resultUrl', preUpscaleUrl.value)
    isUpscaled.value = false
    // 不清空 upscaledUrl，保留缓存以便再次切换
  }

  let resizeObserver: ResizeObserver | null = null
  watch(
    () => viewMode.value === 'slider' && containerRef.value,
    (shouldObserve) => {
      const el = containerRef.value
      if (!shouldObserve || !el) {
        resizeObserver?.disconnect()
        resizeObserver = null
        return
      }
      if (!resizeObserver) {
        resizeObserver = new ResizeObserver((entries) => {
          const entry = entries[0]
          if (!entry || !containerRef.value) return
          const width = (entry.target as HTMLElement).clientWidth
          containerRef.value.style.setProperty('--container-width-px', `${width}px`)
          containerRef.value.style.setProperty('--slider-pct', String(sliderPosition.value))
          lastPct = sliderPosition.value
        })
      }
      resizeObserver.observe(el)
      const width = el.clientWidth
      el.style.setProperty('--container-width-px', `${width}px`)
      el.style.setProperty('--slider-pct', String(sliderPosition.value))
      lastPct = sliderPosition.value
    },
    { immediate: true },
  )
  onUnmounted(() => {
    resizeObserver?.disconnect()
  })

  return {
    viewMode,
    sliderPosition,
    isDragging,
    aspectRatio,
    isUpscaling,
    isUpscaled,
    upscaleError,
    handleMouseDown,
    handleTouchStart,
    handleKeyDown,
    handleDownload,
    handleUpscale,
    handleRevertUpscale,
  }
}
