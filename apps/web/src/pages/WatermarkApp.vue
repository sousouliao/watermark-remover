<script setup lang="ts">
import type { WatermarkModel } from '@/types/app'
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

const modelOptions: { value: WatermarkModel, label: string }[] = [
  { value: 'lite', label: 'Seedream 5.0 Lite' },
  { value: 'flash', label: 'Seedream 5.0 Flash' },
]
const maskEditorRef = ref<InstanceType<typeof MaskEditor> | null>(null)

const {
  steps,
  step,
  imageDataUrl,
  selectedModel,
  mode,
  resultUrl,
  resultModel,
  error,
  currentStepIndex,
  handleImageSelect,
  selectModel,
  selectMode,
  handleReset,
  handleEdit,
  handleProcess: processImage,
  getStepClass,
  getLabelClass,
} = useWatermarkApp()

function handleProcess() {
  return processImage(mode.value === 'region' ? maskEditorRef.value?.getRegion() : null)
}
</script>

<template>
  <div class="flex min-h-svh flex-col">
    <AppHeader />

    <main class="flex flex-1 flex-col items-center px-6 pb-24 md:pb-8">
      <div class="w-full max-w-[1000px]">
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

        <div v-if="error" class="animate-fade-in mb-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4" role="alert">
          <AlertCircle class="h-5 w-5 shrink-0 text-destructive" />
          <p class="flex-1 text-sm font-medium text-destructive">
            {{ error }}
          </p>
          <Button variant="ghost" size="sm" class="shrink-0 text-xs text-destructive" @click="error = null">
            Dismiss
          </Button>
        </div>

        <ImageUploader v-if="step === 'upload'" @image-select="handleImageSelect" />

        <div v-if="imageDataUrl && step !== 'upload'" class="flex flex-col gap-4">
          <div v-if="step !== 'processing'" class="glass-card rounded-2xl p-4">
            <p class="mb-3 text-sm font-medium text-foreground">
              Choose a model
            </p>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                v-for="option in modelOptions"
                :key="option.value"
                type="button"
                class="rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors"
                :class="selectedModel === option.value
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-secondary/40 text-muted-foreground hover:border-primary/50 hover:text-foreground'"
                :aria-pressed="selectedModel === option.value"
                @click="selectModel(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div v-show="step === 'editor'" class="flex flex-col gap-4">
            <div class="glass-card flex flex-wrap gap-2 rounded-2xl p-3">
              <button
                type="button"
                class="rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                :class="mode === 'direct' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'"
                :aria-pressed="mode === 'direct'"
                @click="selectMode('direct')"
              >
                Direct removal
              </button>
              <button
                type="button"
                class="rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                :class="mode === 'region' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'"
                :aria-pressed="mode === 'region'"
                @click="selectMode('region')"
              >
                Mark an area
              </button>
            </div>

            <div v-show="mode === 'direct'" class="glass-card flex justify-center overflow-hidden rounded-2xl p-3">
              <img :src="imageDataUrl" alt="Image to process" class="max-h-[55vh] max-w-full object-contain">
            </div>
            <div v-show="mode === 'region'">
              <MaskEditor ref="maskEditorRef" :image-data-url="imageDataUrl" />
              <p class="mt-2 text-xs text-muted-foreground">
                Mark the watermark's location. The model may still change pixels outside the marked area.
              </p>
            </div>

            <ActionBar
              :is-processing="false"
              :can-process="selectedModel !== null"
              :has-image="true"
              :process-label="mode === 'direct' ? 'Remove Watermark' : 'Remove Marked Area'"
              @process="handleProcess"
              @reset="handleReset"
            />
          </div>

          <div v-if="step === 'processing'" class="flex flex-col items-center gap-4 py-8">
            <ProcessingOverlay />
            <Button variant="outline" @click="handleEdit">
              Cancel
            </Button>
          </div>

          <div v-if="step === 'result' && resultUrl && resultModel" class="flex flex-col gap-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm text-muted-foreground">
                Processed with {{ resultModel === 'lite' ? 'Seedream 5.0 Lite' : 'Seedream 5.0 Flash' }}
              </p>
              <div class="flex gap-2">
                <Button variant="outline" size="sm" @click="handleEdit">
                  Back to edit
                </Button>
                <Button variant="outline" size="sm" @click="handleProcess">
                  Retry
                </Button>
              </div>
            </div>
            <ResultViewer
              :original-url="imageDataUrl"
              :result-url="resultUrl"
              @reset="handleReset"
              @update:result-url="(url: string) => resultUrl = url"
            />
          </div>
        </div>
      </div>
    </main>

    <AppFooter />
  </div>
</template>
