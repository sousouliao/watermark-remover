import type { AppStep, RemoveMode, WatermarkModel } from '@/types/app'
import type { Region } from '@/types/mask'
import { computed, ref } from 'vue'

interface RemoveResponse {
  success: boolean
  data?: { image: string, model: WatermarkModel }
  message?: string | string[]
}

export function useWatermarkApp() {
  const steps = ['Upload', 'Choose & Edit', 'Result']
  const step = ref<AppStep>('upload')
  const imageDataUrl = ref<string | null>(null)
  const selectedModel = ref<WatermarkModel>('lite')
  const mode = ref<RemoveMode>('direct')
  const resultUrl = ref<string | null>(null)
  const resultModel = ref<WatermarkModel | null>(null)
  const error = ref<string | null>(null)

  let requestController: AbortController | null = null
  let requestId = 0

  function invalidateRequest() {
    requestId++
    requestController?.abort()
    requestController = null
  }

  function clearResult() {
    resultUrl.value = null
    resultModel.value = null
    error.value = null
    if (step.value === 'result' || step.value === 'processing') step.value = 'editor'
  }

  function handleImageSelect(_file: File, dataUrl: string) {
    invalidateRequest()
    imageDataUrl.value = dataUrl
    selectedModel.value = 'lite'
    mode.value = 'direct'
    clearResult()
    step.value = 'editor'
  }

  function selectModel(model: WatermarkModel) {
    if (selectedModel.value === model) return
    invalidateRequest()
    selectedModel.value = model
    clearResult()
  }

  function selectMode(value: RemoveMode) {
    if (mode.value === value) return
    invalidateRequest()
    mode.value = value
    clearResult()
  }

  async function handleProcess(region: Region | null = null) {
    const image = imageDataUrl.value
    const model = selectedModel.value
    const requestMode = mode.value
    if (!image || !model) {
      error.value = 'Please select a model before processing.'
      return
    }
    if (requestMode === 'region' && !region) {
      error.value = 'Paint over the watermark before using the marked area.'
      return
    }

    invalidateRequest()
    const currentRequest = requestId
    const controller = new AbortController()
    requestController = controller
    resultUrl.value = null
    resultModel.value = null
    error.value = null
    step.value = 'processing'

    try {
      const response = await fetch('/api/watermark/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, model, mode: requestMode, ...(requestMode === 'region' ? { region } : {}) }),
        signal: controller.signal,
      })
      const result = await response.json() as RemoveResponse
      if (!response.ok || !result.success) {
        const message = typeof result.message === 'string' ? result.message : 'Unable to process this image. Please check it and try again.'
        throw new Error(message)
      }
      if (!result.data?.image?.startsWith('data:image/') || result.data.model !== model) {
        throw new Error('The image service returned an invalid result. Please try again.')
      }
      if (currentRequest !== requestId) return
      resultUrl.value = result.data.image
      resultModel.value = result.data.model
      step.value = 'result'
    }
    catch (cause) {
      if (controller.signal.aborted || currentRequest !== requestId) return
      error.value = cause instanceof Error && cause.name !== 'SyntaxError' && cause.name !== 'TypeError'
        ? cause.message
        : 'Unable to reach the image service. Check that the server is running and try again.'
      step.value = 'editor'
    }
    finally {
      if (currentRequest === requestId) requestController = null
    }
  }

  function handleEdit() {
    invalidateRequest()
    clearResult()
  }

  function handleReset() {
    invalidateRequest()
    imageDataUrl.value = null
    selectedModel.value = 'lite'
    mode.value = 'direct'
    clearResult()
    step.value = 'upload'
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

  return {
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
    handleProcess,
    handleEdit,
    handleReset,
    getStepClass,
    getLabelClass,
  }
}
