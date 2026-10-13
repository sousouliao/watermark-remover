import type { MaskEditorHandle } from '@/components/MaskEditor/MaskEditor'
import type { WatermarkModel } from '@/types/app'
import { Check } from 'lucide-react'
import { useRef } from 'react'
import ActionBar from '@/components/ActionBar/ActionBar'
import AppFooter from '@/components/AppFooter/AppFooter'
import AppHeader from '@/components/AppHeader/AppHeader'
import ImageUploader from '@/components/ImageUploader/ImageUploader'
import MaskEditor from '@/components/MaskEditor/MaskEditor'
import { Alert, AlertClose, AlertContent, AlertDescription, AlertIcon } from '@/components/motion/alert'
import { MotionButton } from '@/components/motion/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs'
import ProcessingOverlay from '@/components/ProcessingOverlay/ProcessingOverlay'
import ResultViewer from '@/components/ResultViewer/ResultViewer'
import { useWatermarkApp } from '@/hooks/useWatermarkApp'
import { cn } from '@/lib/utils'

export default function WatermarkApp() {
  const app = useWatermarkApp()
  const maskEditorRef = useRef<MaskEditorHandle>(null)

  function handleProcess() {
    void app.handleProcess(
      app.mode === 'region' ? (maskEditorRef.current?.getRegion() ?? null) : null,
    )
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <AppHeader />

      <main className="flex flex-1 flex-col items-center px-4 pb-16 pt-3 md:px-6 md:pb-6 md:pt-4">
        <div className="flex w-full max-w-[960px] flex-col gap-3">
          {/* Step Stepper */}
          <nav aria-label="处理步骤" className="self-center">
            <ol className="flex items-center gap-1.5 sm:gap-2.5">
              {app.steps.map((label, index) => {
                const isCurrent = index === app.currentStepIndex
                const isDone = index < app.currentStepIndex
                return (
                  <li
                    key={label}
                    className="flex items-center gap-1.5 sm:gap-2.5"
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    {index > 0 && (
                      <span
                        className={cn(
                          'h-[1px] w-4 sm:w-8 transition-colors duration-200',
                          index <= app.currentStepIndex ? 'bg-foreground' : 'bg-border/60',
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        'flex size-5 sm:size-6 items-center justify-center rounded-md text-[11px] font-mono font-medium transition-all duration-150',
                        isCurrent
                          ? 'bg-foreground text-background'
                          : isDone
                            ? 'bg-secondary text-foreground border border-border/80'
                            : 'bg-muted/30 text-muted-foreground/60 border border-border/40',
                      )}
                    >
                      {isDone ? <Check className="size-2.5 sm:size-3 stroke-[2.5]" /> : index + 1}
                    </span>
                    <span
                      className={cn(
                        'hidden text-xs font-medium sm:block transition-colors',
                        isCurrent ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {label}
                    </span>
                  </li>
                )
              })}
            </ol>
          </nav>

          {/* Global Error Banner */}
          {app.error && (
            <Alert
              variant="destructive"
              open={!!app.error}
              onOpenChange={open => !open && app.setError(null)}
            >
              <AlertIcon />
              <AlertContent>
                <AlertDescription>{app.error}</AlertDescription>
              </AlertContent>
              <AlertClose />
            </Alert>
          )}

          {/* Upload View */}
          {app.step === 'upload' && (
            <div className="py-6 md:py-10">
              <ImageUploader onImageSelect={app.handleImageSelect} />
            </div>
          )}

          {/* Active Workspace */}
          {app.imageDataUrl && app.step !== 'upload' && (
            <div className="flex flex-col gap-3">
              {/* Studio Compact Toolbar (Model & Mode in single compact row) */}
              {app.step !== 'processing' && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/80 px-3 py-1.5 backdrop-blur-md">
                  {/* Model selector */}
                  <div className="flex items-center gap-2">
                    <Tabs
                      value={app.selectedModel}
                      onValueChange={val => app.selectModel(val as WatermarkModel)}
                      variant="segment"
                    >
                      <TabsList className="bg-secondary/60 p-0.5">
                        <TabsTrigger value="lite" className="px-2.5 py-1 text-xs">
                          Seedream 5.0 Lite
                        </TabsTrigger>
                        <TabsTrigger value="flash" className="px-2.5 py-1 text-xs">
                          Seedream 5.0 Flash
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Mode switcher (shown in editor step) */}
                  {app.step === 'editor' && (
                    <div className="flex items-center gap-2">
                      <Tabs
                        value={app.mode}
                        onValueChange={val => app.selectMode(val as 'direct' | 'region')}
                        variant="pill"
                      >
                        <TabsList className="bg-secondary/60 p-0.5">
                          <TabsTrigger value="direct" className="px-2.5 py-1 text-xs">
                            全图消除
                          </TabsTrigger>
                          <TabsTrigger value="region" className="px-2.5 py-1 text-xs">
                            涂抹消除
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  )}
                </div>
              )}

              {/* Editor Workspace */}
              <div hidden={app.step !== 'editor'}>
                <div className="flex flex-col gap-3">
                  {/* Direct Mode Display */}
                  <div hidden={app.mode !== 'direct'}>
                    <div className="glass-card flex max-h-[min(54vh,calc(100svh-270px))] justify-center overflow-hidden rounded-2xl border-border/70 p-2">
                      <img
                        src={app.imageDataUrl}
                        alt="待处理原图"
                        className="max-h-[min(52vh,calc(100svh-280px))] max-w-full rounded-xl object-contain"
                      />
                    </div>
                  </div>

                  {/* Region Mode Display */}
                  <div hidden={app.mode !== 'region'}>
                    <MaskEditor ref={maskEditorRef} imageDataUrl={app.imageDataUrl} />
                  </div>

                  <ActionBar
                    isProcessing={false}
                    canProcess={!!app.selectedModel}
                    hasImage
                    processLabel="消除水印"
                    onProcess={handleProcess}
                    onReset={app.handleReset}
                  />
                </div>
              </div>

              {/* Processing Overlay State */}
              {app.step === 'processing' && (
                <div className="flex flex-col items-center gap-4 py-8 md:py-12">
                  <ProcessingOverlay />
                  <MotionButton
                    variant="outline"
                    size="md"
                    className="rounded-xl text-xs"
                    onClick={app.handleEdit}
                  >
                    取消处理
                  </MotionButton>
                </div>
              )}

              {/* Result State */}
              {app.step === 'result' && app.resultUrl && app.resultModel && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                    <p className="text-xs font-mono text-muted-foreground">
                      MODEL ·
                      {' '}
                      <span className="font-semibold text-foreground">
                        {app.resultModel === 'lite' ? 'Seedream 5.0 Lite' : 'Seedream 5.0 Flash'}
                      </span>
                    </p>
                    <div className="flex gap-2">
                      <MotionButton
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-lg text-xs"
                        onClick={app.handleEdit}
                      >
                        微调区域
                      </MotionButton>
                      <MotionButton
                        variant="secondary"
                        size="sm"
                        className="h-7 rounded-lg text-xs"
                        onClick={handleProcess}
                      >
                        重新生成
                      </MotionButton>
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
