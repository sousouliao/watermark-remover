import type { MaskEditorHandle } from '@/components/MaskEditor/MaskEditor'
import type { WatermarkModel } from '@/types/app'
import { Eraser, ImagePlus } from 'lucide-react'
import { useRef, useState } from 'react'
import AppDock from '@/components/AppDock/AppDock'
import AppFooter from '@/components/AppFooter/AppFooter'
import FloatingAlert from '@/components/FloatingAlert/FloatingAlert'
import ImageUploader from '@/components/ImageUploader/ImageUploader'
import MaskEditor from '@/components/MaskEditor/MaskEditor'
import { Button } from '@/components/motion/button/base'
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs'
import PageHeading from '@/components/PageHeading/PageHeading'
import ProcessingOverlay from '@/components/ProcessingOverlay/ProcessingOverlay'
import ResultViewer from '@/components/ResultViewer/ResultViewer'
import { useWatermarkApp } from '@/hooks/useWatermarkApp'
import { cn } from '@/lib/utils'
import MediaParserApp from '@/pages/MediaParserApp'

type AppTab = 'watermark' | 'parser'

export default function WatermarkApp() {
  const [activeTab, setActiveTab] = useState<AppTab>('watermark')
  const app = useWatermarkApp()
  const maskEditorRef = useRef<MaskEditorHandle>(null)

  function handleProcess() {
    void app.handleProcess(
      app.mode === 'region' ? (maskEditorRef.current?.getRegion() ?? null) : null,
    )
  }

  return (
    <div className="flex min-h-svh flex-col bg-background pt-(--safe-top) text-foreground">
      <main
        className={cn(
          'flex flex-1 flex-col items-center px-4 md:px-6',
          activeTab === 'parser' ? 'pt-0' : cn('pb-[239px]', app.step !== 'upload' && 'pt-6 md:pt-10'),
        )}
      >
        {/* View 1: Watermark Remover */}
        <div hidden={activeTab !== 'watermark'} className="flex w-full flex-1 justify-center">
          {/* 初始上传态与链接解析一致：在 Dock 模糊区以上的空间内垂直居中 */}
          <div className={cn('flex w-full max-w-[960px] flex-col gap-6', app.step === 'upload' && 'justify-center')}>
            <FloatingAlert message={app.error} onDismiss={() => app.setError(null)} />

            {app.step === 'upload' && (
              <div className="flex flex-col gap-8">
                <PageHeading title="图片去水印" description="上传一张图片，选择模型后一键消除水印" />
                <ImageUploader onImageSelect={app.handleImageSelect} />
              </div>
            )}

            {app.imageDataUrl && app.step !== 'upload' && (
              <div className="flex flex-col gap-4">
                {/* 模型与模式常驻：处理中仅锁定，不卸载，保证画布位置不动 */}
                <div
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    app.step === 'processing' && 'pointer-events-none opacity-50',
                  )}
                >
                  <Tabs
                    value={app.selectedModel}
                    onValueChange={val => app.selectModel(val as WatermarkModel)}
                    variant="pill"
                  >
                    <TabsList>
                      <TabsTrigger value="lite">Seedream Lite</TabsTrigger>
                      <TabsTrigger value="flash">Seedream Flash</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {app.step === 'editor' && (
                    <Tabs
                      value={app.mode}
                      onValueChange={val => app.selectMode(val as 'direct' | 'region')}
                      variant="pill"
                    >
                      <TabsList>
                        <TabsTrigger value="direct">全图消除</TabsTrigger>
                        <TabsTrigger value="region">涂抹消除</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
                </div>

                {/* 编辑画布：全图与涂抹共用同一个 Canvas，尺寸完全一致 */}
                <div hidden={app.step !== 'editor'}>
                  <MaskEditor
                    ref={maskEditorRef}
                    imageDataUrl={app.imageDataUrl}
                    mode={app.mode}
                    start={(
                      <Button variant="ghost" aria-label="上传新图片" onClick={app.handleReset}>
                        <ImagePlus className="size-4" />
                        换一张
                      </Button>
                    )}
                    end={(
                      <Button variant="primary" disabled={!app.selectedModel} onClick={handleProcess}>
                        <Eraser className="size-4" />
                        消除水印
                      </Button>
                    )}
                  />
                </div>

                {app.step === 'processing' && (
                  <ProcessingOverlay
                    imageDataUrl={app.imageDataUrl}
                    onCancel={app.handleEdit}
                  />
                )}

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

        {/* View 2: Media Parser */}
        <div hidden={activeTab !== 'parser'} className="flex w-full flex-1 justify-center">
          <MediaParserApp />
        </div>
      </main>

      <AppFooter />

      <AppDock activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
