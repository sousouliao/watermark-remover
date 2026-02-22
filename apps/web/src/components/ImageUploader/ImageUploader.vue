<script setup lang="ts">
import { Image as ImageIcon, Upload, X } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { ACCEPTED_TYPES, MAX_SIZE_BYTES, MAX_SIZE_MB } from '@/constants/upload'
import { cn } from '@/lib/utils'
import { useGlobalStore } from '@/stores/global'

const emit = defineEmits<{
  (e: 'imageSelect', file: File, dataUrl: string): void
}>()

const { isMobile } = storeToRefs(useGlobalStore())

const isDragOver = ref(false)
const error = ref<string | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Unsupported format. Please use PNG, JPG, or WEBP.'
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `File too large. Maximum size is ${MAX_SIZE_MB}MB.`
  }
  return null
}

function handleFile(file: File) {
  const validationError = validateFile(file)
  if (validationError) {
    error.value = validationError
    return
  }
  error.value = null
  const reader = new FileReader()
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string
    emit('imageSelect', file, dataUrl)
  }
  reader.readAsDataURL(file)
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  const file = e.dataTransfer?.files[0]
  if (file) handleFile(file)
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
}

function handleClick() {
  inputRef.value?.click()
}

function handleInputChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) handleFile(file)
}
</script>

<template>
  <div class="animate-fade-in mx-auto w-full max-w-xl px-4">
    <div
      role="button"
      tabindex="0"
      :aria-label="isMobile ? 'Upload image area. Tap to select an image.' : 'Upload image area. Drop your image here or click to browse.'"
      :class="cn(
        'glass-card group relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-8 transition-all duration-300 md:min-h-[320px]',
        isDragOver
          ? 'border-primary bg-primary/5 scale-[1.02]'
          : 'border-border hover:border-primary/50 hover:bg-primary/5',
        error && 'border-destructive/50',
      )"
      @click="handleClick"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @keydown.enter.space.prevent="handleClick"
    >
      <input
        ref="inputRef"
        type="file"
        :accept="ACCEPTED_TYPES.join(',')"
        class="sr-only"
        aria-hidden="true"
        tabindex="-1"
        @change="handleInputChange"
      >

      <div
        :class="cn(
          'flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300',
          isDragOver
            ? 'bg-primary/15 scale-110'
            : 'bg-secondary group-hover:bg-primary/10',
        )"
      >
        <ImageIcon v-if="isDragOver" class="h-8 w-8 text-primary transition-colors" />
        <Upload v-else class="h-8 w-8 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>

      <div class="text-center">
        <p class="text-sm font-medium text-foreground md:text-base">
          {{ isDragOver ? 'Drop your image here' : isMobile ? 'Tap to select an image' : 'Drop your image here or click to browse' }}
        </p>
        <p class="mt-1.5 text-xs text-muted-foreground">
          PNG, JPG, WEBP &middot; Max {{ MAX_SIZE_MB }}MB
        </p>
      </div>

      <div v-if="error" class="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <X class="h-3.5 w-3.5 shrink-0" />
        <span>{{ error }}</span>
      </div>
    </div>
  </div>
</template>
