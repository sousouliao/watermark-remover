import type { AppStep, RemoveMode, WatermarkModel } from '@/types/app'
import type { Region } from '@/types/mask'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface RemoveResponse {
  success: boolean
  data?: { image: string, model: WatermarkModel }
  message?: string | string[]
}

export function useWatermarkApp() {
  const [step, setStep] = useState<AppStep>('upload')
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<WatermarkModel>('lite')
  const [mode, setMode] = useState<RemoveMode>('direct')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultModel, setResultModel] = useState<WatermarkModel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<{ id: number, controller: AbortController | null }>({
    id: 0,
    controller: null,
  })

  const invalidateRequest = useCallback(() => {
    request.current.id++
    request.current.controller?.abort()
    request.current.controller = null
  }, [])
  useEffect(() => invalidateRequest, [invalidateRequest])

  const clearResult = useCallback(() => {
    setResultUrl(null)
    setResultModel(null)
    setError(null)
    setStep(value => (value === 'result' || value === 'processing' ? 'editor' : value))
  }, [])

  const loadImage = useCallback(
    (dataUrl: string) => {
      invalidateRequest()
      setImageDataUrl(dataUrl)
      setSelectedModel('lite')
      setMode('direct')
      clearResult()
      setStep('editor')
    },
    [invalidateRequest, clearResult],
  )

  const handleImageSelect = useCallback(
    (_file: File, dataUrl: string) => {
      loadImage(dataUrl)
    },
    [loadImage],
  )

  const selectModel = useCallback(
    (model: WatermarkModel) => {
      if (selectedModel === model) return
      invalidateRequest()
      setSelectedModel(model)
      clearResult()
    },
    [selectedModel, invalidateRequest, clearResult],
  )

  const selectMode = useCallback(
    (value: RemoveMode) => {
      if (mode === value) return
      invalidateRequest()
      setMode(value)
      clearResult()
    },
    [mode, invalidateRequest, clearResult],
  )

  const handleProcess = useCallback(
    async (region: Region | null = null) => {
      if (!imageDataUrl) {
        setError('请先上传图片并选择模型。')
        return
      }
      if (mode === 'region' && !region) {
        setError('请先涂抹需要移除的水印区域。')
        return
      }
      invalidateRequest()
      const id = request.current.id
      const controller = new AbortController()
      request.current.controller = controller
      clearResult()
      setStep('processing')
      try {
        const response = await apiFetch('/api/watermark/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: imageDataUrl,
            model: selectedModel,
            mode,
            ...(mode === 'region' ? { region } : {}),
          }),
          signal: controller.signal,
        })
        const result = (await response.json()) as RemoveResponse
        if (!response.ok || !result.success) {
          throw new Error(
            typeof result.message === 'string' ? result.message : '无法处理这张图片，请检查后重试。',
          )
        }
        if (!result.data?.image?.startsWith('data:image/') || result.data.model !== selectedModel) {
          throw new Error('图片服务返回了无效结果，请重试。')
        }
        if (controller.signal.aborted || id !== request.current.id) return
        setResultUrl(result.data.image)
        setResultModel(result.data.model)
        setStep('result')
      }
      catch (cause) {
        if (controller.signal.aborted || id !== request.current.id) return
        setError(
          cause instanceof Error && cause.name !== 'SyntaxError' && cause.name !== 'TypeError'
            ? cause.message
            : '无法连接图片服务，请确认服务已启动后重试。',
        )
        setStep('editor')
      }
      finally {
        if (id === request.current.id) request.current.controller = null
      }
    },
    [imageDataUrl, selectedModel, mode, invalidateRequest, clearResult],
  )

  const handleEdit = useCallback(() => {
    invalidateRequest()
    clearResult()
  }, [invalidateRequest, clearResult])
  const handleReset = useCallback(() => {
    invalidateRequest()
    setImageDataUrl(null)
    setSelectedModel('lite')
    setMode('direct')
    clearResult()
    setStep('upload')
  }, [invalidateRequest, clearResult])

  return {
    step,
    imageDataUrl,
    selectedModel,
    mode,
    resultUrl,
    setResultUrl,
    resultModel,
    error,
    setError,
    loadImage,
    handleImageSelect,
    selectModel,
    selectMode,
    handleProcess,
    handleEdit,
    handleReset,
  }
}
export type WatermarkAppInstance = ReturnType<typeof useWatermarkApp>
