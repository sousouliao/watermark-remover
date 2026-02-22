import type { AppStep } from '@/types/app'
import { computed, ref } from 'vue'

export function useWatermarkApp() {
  const steps: string[] = ['Upload', 'Edit', 'Result']
  const step = ref<AppStep>('upload')
  const imageFile = ref<File | null>(null)
  const imageDataUrl = ref<string | null>(null)
  const resultUrl = ref<string | null>(null)
  const error = ref<string | null>(null)

  function handleImageSelect(file: File, dataUrl: string) {
    imageFile.value = file
    imageDataUrl.value = dataUrl
    resultUrl.value = null
    error.value = null
    step.value = 'editor'
  }

  async function handleProcess(getMaskDataUrl: () => string | null) {
    const maskDataUrl = getMaskDataUrl()
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

  return {
    steps,
    step,
    imageFile,
    imageDataUrl,
    resultUrl,
    error,
    currentStepIndex,
    handleImageSelect,
    handleProcess,
    getStepClass,
    getLabelClass,
    handleReset,
  }
}
