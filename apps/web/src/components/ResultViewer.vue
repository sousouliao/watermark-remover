<script setup lang="ts">
import { Columns2, Download, GripVertical, RotateCcw } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const props = defineProps<{
  originalUrl: string
  resultUrl: string
}>()

const emit = defineEmits<{
  (e: 'reset'): void
}>()

const viewMode = ref<'slider' | 'side-by-side'>('slider')
const sliderPosition = ref(50)
const isDragging = ref(false)
const containerRef = ref<HTMLDivElement | null>(null)
const imageSize = ref({ width: 0, height: 0 })

// Load image size for proper aspect ratio
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

function updateSlider(clientX: number) {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const x = clientX - rect.left
  const pct = Math.max(0, Math.min(100, (x / rect.width) * 100))
  sliderPosition.value = pct
}

function handleMouseDown(e: MouseEvent) {
  e.preventDefault()
  isDragging.value = true
  updateSlider(e.clientX)
}

function handleTouchStart(e: TouchEvent) {
  isDragging.value = true
  updateSlider(e.touches[0].clientX)
}

function handleMove(e: MouseEvent | TouchEvent) {
  if (!isDragging.value) return
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  updateSlider(clientX)
}

function handleUp() {
  isDragging.value = false
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') sliderPosition.value = Math.max(0, sliderPosition.value - 2)
  if (e.key === 'ArrowRight') sliderPosition.value = Math.min(100, sliderPosition.value + 2)
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
})

function handleDownload() {
  const a = document.createElement('a')
  a.href = props.resultUrl
  a.download = `watermark-removed-${Date.now()}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const containerWidth = computed(() => containerRef.value?.clientWidth || 0)
</script>

<template>
  <div class="animate-fade-in flex flex-col gap-4">
    <!-- View mode toggle -->
    <div class="flex items-center justify-between">
      <p class="text-xs font-medium text-muted-foreground">
        Result Preview
      </p>
      <div class="flex items-center gap-1 rounded-lg bg-secondary p-0.5">
        <button
          :class="cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
            viewMode === 'slider'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )"
          aria-label="Comparison slider view"
          @click="viewMode = 'slider'"
        >
          Slider
        </button>
        <button
          :class="cn(
            'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all',
            viewMode === 'side-by-side'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )"
          aria-label="Side by side view"
          @click="viewMode = 'side-by-side'"
        >
          <Columns2 class="h-3 w-3" />
          <span class="hidden sm:inline">Compare</span>
        </button>
      </div>
    </div>

    <!-- Comparison slider -->
    <template v-if="viewMode === 'slider'">
      <div
        ref="containerRef"
        class="glass-card relative max-h-[70vh] cursor-col-resize select-none overflow-hidden rounded-2xl"
        :style="{ aspectRatio }"
        role="slider"
        aria-label="Before and after comparison slider"
        :aria-valuemin="0"
        :aria-valuemax="100"
        :aria-valuenow="Math.round(sliderPosition)"
        tabindex="0"
        @mousedown="handleMouseDown"
        @touchstart="handleTouchStart"
        @keydown="handleKeyDown"
      >
        <!-- Result (full background) -->
        <img
          :src="resultUrl"
          alt="Processed result"
          class="absolute inset-0 h-full w-full object-contain"
          draggable="false"
        >

        <!-- Original (clipped) -->
        <div
          class="absolute inset-0 overflow-hidden"
          :style="{ width: `${sliderPosition}%` }"
        >
          <img
            :src="originalUrl"
            alt="Original image"
            class="absolute inset-0 h-full w-full object-contain"
            :style="{
              width: containerWidth ? `${containerWidth}px` : '100vw',
              maxWidth: 'none',
            }"
            draggable="false"
          >
        </div>

        <!-- Slider handle -->
        <div
          class="absolute top-0 bottom-0 z-10 flex w-0.5 items-center justify-center"
          :style="{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }"
        >
          <div class="h-full w-0.5 bg-background/90 shadow-lg" />
          <div class="absolute flex h-10 w-6 items-center justify-center rounded-full bg-background shadow-lg ring-1 ring-border">
            <GripVertical class="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <!-- Labels -->
        <div class="pointer-events-none absolute top-3 left-3 rounded-full bg-foreground/70 px-2.5 py-1 text-[10px] font-medium text-background backdrop-blur-sm">
          Original
        </div>
        <div class="pointer-events-none absolute top-3 right-3 rounded-full bg-primary/80 px-2.5 py-1 text-[10px] font-medium text-primary-foreground backdrop-blur-sm">
          Result
        </div>
      </div>
    </template>

    <!-- Side by side -->
    <template v-else>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="glass-card overflow-hidden rounded-2xl">
          <div class="bg-secondary/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Original
          </div>
          <img
            :src="originalUrl"
            alt="Original image"
            class="w-full object-contain"
            :style="{ aspectRatio }"
          >
        </div>
        <div class="glass-card overflow-hidden rounded-2xl">
          <div class="bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            Result
          </div>
          <img
            :src="resultUrl"
            alt="Processed result"
            class="w-full object-contain"
            :style="{ aspectRatio }"
          >
        </div>
      </div>
    </template>

    <!-- Action buttons -->
    <div class="flex flex-col gap-2 sm:flex-row sm:justify-center">
      <Button
        class="gradient-btn h-11 gap-2 rounded-xl text-sm font-medium text-primary-foreground shadow-md shadow-primary/15 transition-all hover:shadow-lg hover:shadow-primary/20"
        @click="handleDownload"
      >
        <Download class="h-4 w-4" />
        Download Result
      </Button>
      <Button
        variant="outline"
        class="h-11 gap-2 rounded-xl text-sm"
        @click="emit('reset')"
      >
        <RotateCcw class="h-4 w-4" />
        Try Another Image
      </Button>
    </div>
  </div>
</template>
