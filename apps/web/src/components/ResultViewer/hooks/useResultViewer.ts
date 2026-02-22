import type { ViewMode } from '@/types/app'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

export function useResultViewer(props: { originalUrl: string, resultUrl: string }) {
  const viewMode = ref<ViewMode>('slider')
  const sliderPosition = ref(50)
  const isDragging = ref(false)
  const containerRef = ref<HTMLDivElement | null>(null)
  const imageSize = ref({ width: 0, height: 0 })

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
    window.removeEventListener('mousemove', handleMove)
    window.removeEventListener('mouseup', handleUp)
    window.removeEventListener('touchmove', handleMove)
    window.removeEventListener('touchend', handleUp)
    if (rafId !== 0) cancelAnimationFrame(rafId)
  })

  function handleDownload() {
    const a = document.createElement('a')
    a.href = props.resultUrl
    a.download = `watermark-removed-${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
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
    containerRef,
    aspectRatio,
    handleMouseDown,
    handleTouchStart,
    handleMove,
    handleUp,
    handleKeyDown,
    handleDownload,
  }
}
