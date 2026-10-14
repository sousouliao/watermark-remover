import type { MaskEditorHandle } from '@/components/MaskEditor/MaskEditor'
import type { WatermarkModel } from '@/types/app'
import { Check } from 'lucide-react'
import { useRef, useState } from 'react'
import ActionBar from '@/components/ActionBar/ActionBar'
import AppDock from '@/components/AppDock/AppDock'
import AppFooter from '@/components/AppFooter/AppFooter'
import AppHeader from '@/components/AppHeader/AppHeader'
import ImageUploader from '@/components/ImageUploader/ImageUploader'
import MaskEditor from '@/components/MaskEditor/MaskEditor'
import { Alert, AlertClose, AlertContent, AlertDescription, AlertIcon } from '@/components/motion/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs'
import ProcessingOverlay from '@/components/ProcessingOverlay/ProcessingOverlay'
import ResultViewer from '@/components/ResultViewer/ResultViewer'
import { useWatermarkApp } from '@/hooks/useWatermarkApp'
import { cn } from '@/lib/utils'
import XHSApp from '@/pages/XHSApp'

type AppTab = 'watermark' | 'xhs'

export default function WatermarkApp() {
  const [activeTab, setActiveTab] = useState<AppTab>('watermark')
  const app = useWatermarkApp()
  const maskEditorRef = useRef<MaskEditorHandle>(null)

  function handleProcess() {
    void app.handleProcess(
      app.mode === 'region' ? (maskEditorRef.current?.getRegion() ?? null) : null,
    )
  }

  function handleImportFromXHS(dataUrl: string) {
    app.loadImage(dataUrl)
    setActiveTab('watermark')
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <AppHeader />

      <main className="flex flex-1 flex-col items-center px-4 pb-[239px] pt-4 md:px-6 md:pt-6">
        {/* View 1: Watermark Remover */}
        <div hidden={activeTab !== 'watermark'} className="w-full flex justify-center">
          <div className="flex w-full max-w-[960px] flex-col gap-4">
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
                {/* Studio Compact Toolbar */}
                {app.step !== 'processing' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-full border border-border/60 bg-card/80 p-1.5 backdrop-blur-md">
                    {/* Model selector */}
                    <div className="flex items-center gap-2">
                      <Tabs
                        value={app.selectedModel}
                        onValueChange={val => app.selectModel(val as WatermarkModel)}
                        variant="pill"
                      >
                        <TabsList>
                          <TabsTrigger value="lite">
                            Seedream 5.0 Lite
                          </TabsTrigger>
                          <TabsTrigger value="flash">
                            Seedream 5.0 Flash
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>

                    {/* Mode switcher */}
                    {app.step === 'editor' && (
                      <div className="flex items-center gap-2">
                        <Tabs
                          value={app.mode}
                          onValueChange={val => app.selectMode(val as 'direct' | 'region')}
                          variant="pill"
                        >
                          <TabsList>
                            <TabsTrigger value="direct">
                              全图消除
                            </TabsTrigger>
                            <TabsTrigger value="region">
                              涂抹消除
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                    )}
                  </div>
                )}

                {/* Editor Workspace (Unified canvas: 100% identical size for both direct and region) */}
                <div hidden={app.step !== 'editor'}>
                  <div className="flex flex-col gap-3">
                    <MaskEditor
                      ref={maskEditorRef}
                      imageDataUrl={app.imageDataUrl}
                      mode={app.mode}
                    />

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

                {/* Processing Overlay State (In-situ studio stage, zero layout shift) */}
                {app.step === 'processing' && (
                  <div className="w-full">
                    <ProcessingOverlay
                      imageDataUrl={app.imageDataUrl}
                      model={app.selectedModel}
                      onCancel={app.handleEdit}
                    />
                  </div>
                )}

                {/* Result State (Zero top gap shift, aligned precisely with editor canvas) */}
                {app.step === 'result' && app.resultUrl && (
                  <ResultViewer
                    originalUrl={app.imageDataUrl}
                    resultUrl={app.resultUrl}
                    onReset={app.handleReset}
                    onResultChange={app.setResultUrl}
                  />
                )}

              </div>
            )}
          </div>
        </div>

        {/* View 2: Xiaohongshu Parser */}
        <div hidden={activeTab !== 'xhs'} className="w-full flex justify-center">
          <XHSApp onImportToWatermark={handleImportFromXHS} />
        </div>
      </main>

      <AppFooter />

      <AppDock activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
