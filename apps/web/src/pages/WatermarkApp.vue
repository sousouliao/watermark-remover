<script setup lang="ts">
import { AlertCircle, Check } from 'lucide-vue-next'
import { ref } from 'vue'
import ActionBar from '@/components/ActionBar/ActionBar.vue'
import AppFooter from '@/components/AppFooter/AppFooter.vue'
import AppHeader from '@/components/AppHeader/AppHeader.vue'
import ImageUploader from '@/components/ImageUploader/ImageUploader.vue'
import MaskEditor from '@/components/MaskEditor/MaskEditor.vue'
import ProcessingOverlay from '@/components/ProcessingOverlay/ProcessingOverlay.vue'
import ResultViewer from '@/components/ResultViewer/ResultViewer.vue'
import { Button } from '@/components/ui/button'
import { useWatermarkApp } from '@/hooks/useWatermarkApp'

const maskEditorRef = ref<InstanceType<typeof MaskEditor> | null>(null)

const {
  steps,
  step,
  imageDataUrl,
  resultUrl,
  error,
  currentStepIndex,
  handleImageSelect,
  handleReset,
  handleProcess: processImage,
  getStepClass,
  getLabelClass,
} = useWatermarkApp()

function handleProcess() {
  return processImage(() => maskEditorRef.value?.getMaskDataUrl() ?? null)
}
</script>

<template>
  <div class="flex min-h-svh flex-col">
    <AppHeader />

    <main class="flex flex-1 flex-col items-center px-6 pb-24 md:pb-8">
      <div class="w-full max-w-[1000px]">
        <!-- Step indicators -->
        <div class="mb-6 flex items-center justify-center gap-2 md:mb-8">
          <div v-for="(label, i) in steps" :key="label" class="flex items-center gap-2">
            <div
              v-if="i > 0"
              class="h-0.5 w-6 transition-colors md:w-10"
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
