<script setup lang="ts">
import { Minus, Paintbrush, Plus, Trash2, Undo2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { useMaskEditor } from './hooks/useMaskEditor'

const props = defineProps<{
  imageDataUrl: string
}>()

const {
  containerRef,
  imageCanvasRef,
  maskCanvasRef,
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
  getMaskDataUrl,
  hasMask,
} = useMaskEditor(props)

defineExpose({ getMaskDataUrl, hasMask })
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
              class="rounded-full bg-cyan-400/60 transition-all duration-150"
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
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
            class="h-8 gap-1.5 rounded-xl border-border bg-secondary/50 px-2.5 text-xs text-foreground hover:bg-secondary hover:text-foreground"
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
            class="h-8 gap-1.5 rounded-xl border-destructive/40 bg-destructive/10 px-2.5 text-xs text-destructive hover:border-destructive/60 hover:bg-destructive/20 hover:text-destructive"
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
          class="absolute inset-0 cursor-none touch-none"
          :style="{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }"
          aria-label="Mask drawing canvas. Use your mouse or finger to paint over the watermark."
          role="img"
          @mousedown="handlePointerDown"
          @mouseenter="handlePointerEnter"
          @mousemove="handlePointerMove"
          @mouseup="handlePointerUp"
          @mouseleave="handlePointerLeave"
          @touchstart.prevent="handlePointerDown"
          @touchmove.prevent="handlePointerMove"
          @touchend.prevent="handlePointerUp"
        />
        <div
          v-show="isHovering && !isDrawing"
          class="pointer-events-none absolute rounded-full border border-cyan-400 bg-cyan-400/30"
          :style="{
            width: `${brushSize[0]}px`,
            height: `${brushSize[0]}px`,
            left: `${cursorX - brushSize[0] / 2}px`,
            top: `${cursorY - brushSize[0] / 2}px`,
          }"
        />
      </div>
    </div>
  </div>
</template>
