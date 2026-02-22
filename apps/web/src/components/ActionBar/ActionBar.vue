<script setup lang="ts">
import { ImagePlus, Loader2, Wand2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

defineProps<{
  isProcessing: boolean
  canProcess: boolean
  hasImage: boolean
}>()

const emit = defineEmits<{
  (e: 'process'): void
  (e: 'reset'): void
}>()
</script>

<template>
  <template v-if="hasImage">
    <!-- Desktop inline actions -->
    <div class="hidden items-center justify-center gap-3 md:flex">
      <Button
        variant="outline"
        :disabled="isProcessing"
        class="h-11 gap-2 rounded-xl border-border bg-secondary/50 text-sm text-foreground hover:bg-secondary hover:text-foreground"
        aria-label="Upload new image"
        @click="emit('reset')"
      >
        <ImagePlus class="h-4 w-4" />
        New Image
      </Button>
      <Button
        :disabled="!canProcess || isProcessing"
        class="gradient-btn h-11 gap-2 rounded-xl px-8 text-sm font-medium text-primary-foreground shadow-md shadow-primary/15 transition-all hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50 disabled:shadow-none"
        aria-label="Remove watermark from image"
        @click="emit('process')"
      >
        <template v-if="isProcessing">
          <Loader2 class="h-4 w-4 animate-spin" />
          Processing...
        </template>
        <template v-else>
          <Wand2 class="h-4 w-4" />
          Remove Watermark
        </template>
      </Button>
    </div>

    <!-- Mobile fixed bottom bar -->
    <div class="fixed inset-x-0 bottom-0 z-50 flex items-center gap-2.5 border-t border-border bg-background/80 px-4 py-3 backdrop-blur-xl md:hidden" style="padding-bottom: calc(0.75rem + var(--safe-bottom))">
      <Button
        variant="outline"
        :disabled="isProcessing"
        size="icon"
        class="h-11 w-11 shrink-0 rounded-xl border-border bg-secondary/50 text-foreground hover:bg-secondary hover:text-foreground"
        aria-label="Upload new image"
        @click="emit('reset')"
      >
        <ImagePlus class="h-4 w-4" />
      </Button>
      <Button
        :disabled="!canProcess || isProcessing"
        class="gradient-btn h-11 flex-1 gap-2 rounded-xl text-sm font-medium text-primary-foreground shadow-md shadow-primary/15 disabled:opacity-50 disabled:shadow-none"
        aria-label="Remove watermark from image"
        @click="emit('process')"
      >
        <template v-if="isProcessing">
          <Loader2 class="h-4 w-4 animate-spin" />
          Processing...
        </template>
        <template v-else>
          <Wand2 class="h-4 w-4" />
          Remove Watermark
        </template>
      </Button>
    </div>
  </template>
</template>
