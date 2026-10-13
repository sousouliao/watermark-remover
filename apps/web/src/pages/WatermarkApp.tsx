import { useRef } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import ActionBar from '@/components/ActionBar/ActionBar'
import AppFooter from '@/components/AppFooter/AppFooter'
import AppHeader from '@/components/AppHeader/AppHeader'
import ImageUploader from '@/components/ImageUploader/ImageUploader'
import MaskEditor from '@/components/MaskEditor/MaskEditor'
import type { MaskEditorHandle } from '@/components/MaskEditor/MaskEditor'
import ProcessingOverlay from '@/components/ProcessingOverlay/ProcessingOverlay'
import ResultViewer from '@/components/ResultViewer/ResultViewer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useWatermarkApp } from '@/hooks/useWatermarkApp'
import { cn } from '@/lib/utils'
import type { WatermarkModel } from '@/types/app'

const modelOptions: { value: WatermarkModel; label: string }[] = [
  { value: 'lite', label: 'Seedream 5.0 Lite' },
  { value: 'flash', label: 'Seedream 5.0 Flash' }
]
export default function WatermarkApp() {
  const app = useWatermarkApp()
  const maskEditorRef = useRef<MaskEditorHandle>(null)
  function handleProcess() {
    void app.handleProcess(
      app.mode === 'region' ? (maskEditorRef.current?.getRegion() ?? null) : null
    )
  }
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <main className="flex flex-1 flex-col items-center px-6 pb-24 md:pb-8">
        <div className="w-full max-w-[1000px]">
          <ol className="mb-6 flex items-center justify-center gap-2 md:mb-8" aria-label="处理步骤">
            {app.steps.map((label, index) => (
              <li
                key={label}
                className="flex items-center gap-2"
                aria-current={index === app.currentStepIndex ? 'step' : undefined}
              >
                {index > 0 && (
                  <span
                    className={cn(
                      'h-0.5 w-6 md:w-10',
                      index <= app.currentStepIndex ? 'bg-primary' : 'bg-border'
                    )}
                  />
                )}
                <span
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full text-xs font-medium',
                    index === app.currentStepIndex
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                      : index < app.currentStepIndex
                        ? 'bg-primary/20 text-primary'
                        : 'bg-secondary text-muted-foreground'
                  )}
                >
                  {index < app.currentStepIndex ? <Check className="size-3" /> : index + 1}
                </span>
                <span
                  className={cn(
                    'hidden text-xs font-medium sm:block',
                    index === app.currentStepIndex ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {label}
                </span>
              </li>
            ))}
          </ol>
          {app.error && (
            <div
              className="mb-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
              role="alert"
            >
              <AlertCircle className="size-5 shrink-0 text-destructive" />
              <p className="flex-1 text-sm text-destructive">{app.error}</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => app.setError(null)}
              >
                关闭
              </Button>
            </div>
          )}
          {app.step === 'upload' && <ImageUploader onImageSelect={app.handleImageSelect} />}
          {app.imageDataUrl && app.step !== 'upload' && (
            <div className="flex flex-col gap-4">
              {app.step !== 'processing' && (
                <Card className="glass-card rounded-2xl p-4">
                  <p className="mb-3 text-sm font-medium">选择模型</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {modelOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={app.selectedModel === option.value}
                        className={cn(
                          'rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors',
                          app.selectedModel === option.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-secondary/40 text-muted-foreground hover:border-primary/50'
                        )}
                        onClick={() => app.selectModel(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </Card>
              )}
              <div hidden={app.step !== 'editor'}>
                <div className="flex flex-col gap-4">
                  <Card className="glass-card flex flex-wrap gap-2 rounded-2xl p-3">
                    {(
                      [
                        { value: 'direct', label: '直接去水印' },
                        { value: 'region', label: '指定区域' }
                      ] as const
                    ).map((option) => (
                      <Button
                        key={option.value}
                        variant={app.mode === option.value ? 'default' : 'ghost'}
                        aria-pressed={app.mode === option.value}
                        onClick={() => app.selectMode(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </Card>
                  <div hidden={app.mode !== 'direct'}>
                    <div className="glass-card flex justify-center overflow-hidden rounded-2xl p-3">
                      <img
                        src={app.imageDataUrl}
                        alt="待处理图片"
                        className="max-h-[55vh] max-w-full object-contain"
                      />
                    </div>
                  </div>
                  <div hidden={app.mode !== 'region'}>
                    <MaskEditor ref={maskEditorRef} imageDataUrl={app.imageDataUrl} />
                    <p className="mt-2 text-xs text-muted-foreground">
                      标记水印位置。模型仍可能修改标记区域外的像素。
                    </p>
                  </div>
                  <ActionBar
                    isProcessing={false}
                    canProcess={!!app.selectedModel}
                    hasImage
                    processLabel={app.mode === 'direct' ? '移除水印' : '移除标记区域'}
                    onProcess={handleProcess}
                    onReset={app.handleReset}
                  />
                </div>
              </div>
              {app.step === 'processing' && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <ProcessingOverlay />
                  <Button variant="outline" onClick={app.handleEdit}>
                    取消
                  </Button>
                </div>
              )}
              {app.step === 'result' && app.resultUrl && app.resultModel && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      使用 {app.resultModel === 'lite' ? 'Seedream 5.0 Lite' : 'Seedream 5.0 Flash'}{' '}
                      处理
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={app.handleEdit}>
                        返回编辑
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleProcess}>
                        重试
                      </Button>
                    </div>
                  </div>
                  <ResultViewer
                    originalUrl={app.imageDataUrl}
                    resultUrl={app.resultUrl}
                    onReset={app.handleReset}
                    onResultChange={app.setResultUrl}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <AppFooter />
    </div>
  )
}
