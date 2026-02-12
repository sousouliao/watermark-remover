<script setup lang="ts">
import { AlertCircle, Check } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import ActionBar from './ActionBar.vue'
import AppFooter from './AppFooter.vue'
import AppHeader from './AppHeader.vue'
import ImageUploader from './ImageUploader.vue'
import MaskEditor from './MaskEditor.vue'
import ProcessingOverlay from './ProcessingOverlay.vue'
import ResultViewer from './ResultViewer.vue'

type AppStep = 'upload' | 'editor' | 'processing' | 'result'

const steps: string[] = ['Upload', 'Edit', 'Result']
const step = ref<AppStep>('upload')
const imageFile = ref<File | null>(null)
const imageDataUrl = ref<string | null>(null)
const resultUrl = ref<string | null>(null)
const error = ref<string | null>(null)
const maskEditorRef = ref<InstanceType<typeof MaskEditor> | null>(null)

function handleImageSelect(file: File, dataUrl: string) {
  imageFile.value = file
  imageDataUrl.value = dataUrl
  resultUrl.value = null
  error.value = null
  step.value = 'editor'
}

async function handleProcess() {
  const maskDataUrl = maskEditorRef.value?.getMaskDataUrl()
  if (!maskDataUrl) return

  error.value = null
  step.value = 'processing'

  try {
    const response = await fetch('/api/watermark/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageDataUrl.value,
        mask: maskDataUrl,
      }),
    })

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`)
    }

    const result = await response.json()
    if (result.success) {
      resultUrl.value = result.data.image
      step.value = 'result'
    }
    else {
      throw new Error(result.message || 'Unknown server error')
    }
  }
  catch (err) {
    console.error(err)
    error.value = 'Something went wrong. Please try again.'
    step.value = 'editor'
  }
}

const currentStepIndex = computed(() => {
  if (step.value === 'upload') return 0
  if (step.value === 'editor' || step.value === 'processing') return 1
  return 2
})

function getStepClass(i: number) {
  if (i === currentStepIndex.value) return 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
  if (i < currentStepIndex.value) return 'bg-primary/20 text-primary'
  return 'bg-secondary text-muted-foreground'
}

function getLabelClass(i: number) {
  return i === currentStepIndex.value ? 'text-foreground' : 'text-muted-foreground'
}

function handleReset() {
  step.value = 'upload'
  imageFile.value = null
  imageDataUrl.value = null
  resultUrl.value = null
  error.value = null
}
</script>

<template>
  <div class="flex min-h-svh flex-col">
    <AppHeader />

    <main class="flex flex-1 flex-col items-center px-4 pb-24 md:pb-8">
      <div class="w-full max-w-[1000px]">
        <!-- Step indicators -->
        <div class="mb-6 flex items-center justify-center gap-2 md:mb-8">
          <div v-for="(label, i) in steps" :key="label" class="flex items-center gap-2">
            <div
              v-if="i > 0"
              class="h-px w-6 transition-colors md:w-10"
              :class="[i <= currentStepIndex ? 'bg-primary' : 'bg-border']"
            />
            <div class="flex items-center gap-1.5">
              <div class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-all" :class="[getStepClass(i)]">
                <Check v-if="i < currentStepIndex" class="h-3 w-3" />
                <span v-else>{{ i + 1 }}</span>
              </div>
              <span class="hidden text-xs font-medium sm:block" :class="[getLabelClass(i)]">
                {{ label }}
              </span>
            </div>
          </div>
        </div>

        <!-- Error display -->
        <div v-if="error" class="animate-fade-in mb-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle class="h-5 w-5 shrink-0 text-destructive" />
          <div class="flex-1">
            <p class="text-sm font-medium text-destructive">
              {{ error }}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            class="shrink-0 text-xs text-destructive hover:text-destructive"
            @click="error = null"
          >
            Dismiss
          </Button>
        </div>

        <!-- Content area -->
        <ImageUploader v-if="step === 'upload'" @image-select="handleImageSelect" />

        <div v-else-if="step === 'editor' && imageDataUrl" class="flex flex-col gap-4">
          <MaskEditor ref="maskEditorRef" :image-data-url="imageDataUrl" />
          <ActionBar
            :is-processing="false"
            :can-process="true"
            :has-image="true"
            @process="handleProcess"
            @reset="handleReset"
          />
        </div>

        <div v-else-if="step === 'processing'" class="flex justify-center py-8">
          <ProcessingOverlay />
        </div>

        <ResultViewer
          v-else-if="step === 'result' && imageDataUrl && resultUrl"
          :original-url="imageDataUrl"
          :result-url="resultUrl"
          @reset="handleReset"
        />
      </div>
    </main>

    <AppFooter />
  </div>
</template>
