import type { CSSProperties } from 'react'
import { Columns2, Download, GripVertical, RotateCcw, SlidersHorizontal, Sparkles, Undo2 } from 'lucide-react'
import { Alert, AlertContent, AlertDescription, AlertIcon } from '@/components/motion/alert'
import { MotionButton } from '@/components/motion/button'
import { Loader } from '@/components/motion/loader'
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs'
import { cn } from '@/lib/utils'
import { useResultViewer } from './hooks/useResultViewer'

interface Props {
  originalUrl: string
  resultUrl: string
  onReset: () => void
  onResultChange: (url: string) => void
}

export default function ResultViewer(props: Props) {
  const viewer = useResultViewer(props)
  const { viewMode, aspectRatio } = viewer

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Tabs
          value={viewMode}
          onValueChange={val => viewer.setViewMode(val as 'slider' | 'side-by-side')}
          variant="segment"
        >
          <TabsList className="bg-secondary/60">
            <TabsTrigger value="slider" className="gap-1.5 text-xs">
              <SlidersHorizontal className="size-3" />
              <span>滑动</span>
            </TabsTrigger>
            <TabsTrigger value="side-by-side" className="gap-1.5 text-xs">
              <Columns2 className="size-3" />
              <span>并排</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewMode === 'slider'
        ? (
            <div
              ref={viewer.containerRef}
              className={cn(
                'glass-card relative max-h-[70vh] touch-none cursor-col-resize select-none overflow-hidden rounded-md border-border',
                viewer.isDragging && 'is-dragging',
              )}
              style={{ aspectRatio, '--slider-pct': viewer.sliderPosition } as CSSProperties}
              role="slider"
              aria-label="原图与结果对比"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(viewer.sliderPosition)}
              tabIndex={0}
              onPointerDown={viewer.handlePointerDown}
              onPointerMove={viewer.handlePointerMove}
              onPointerUp={viewer.handlePointerUp}
              onPointerCancel={viewer.handlePointerUp}
              onLostPointerCapture={viewer.handlePointerUp}
              onKeyDown={viewer.handleKeyDown}
            >
              <img
                src={props.originalUrl}
                alt="原图"
                className="absolute inset-0 h-full w-full object-contain"
                draggable={false}
              />
              <img
                src={props.resultUrl}
                alt="处理结果"
                className="absolute inset-0 h-full w-full object-contain"
                style={{ clipPath: 'inset(0 0 0 calc(var(--slider-pct) * 1%))' }}
                draggable={false}
              />

              {/* Divider line & grip */}
              <div
                className="absolute inset-y-0 z-10 flex w-0.5 items-center justify-center bg-white"
                style={{ left: 'calc(var(--slider-pct) * 1%)', transform: 'translateX(-50%)' }}
              >
                <div className="absolute flex h-9 w-6 items-center justify-center rounded-full border border-black/20 bg-white text-black dark:border-white/30 dark:bg-white dark:text-black">
                  <GripVertical className="size-3.5" />
                </div>
              </div>

              {/* Badges */}
              <span className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/20 bg-black/80 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                原图
              </span>
              <span className="pointer-events-none absolute right-3 top-3 rounded-full border border-black/10 bg-white/95 px-2.5 py-0.5 text-[11px] font-medium text-black backdrop-blur-sm">
                去水印
              </span>
            </div>
          )
        : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { url: props.originalUrl, label: '原图' },
                { url: props.resultUrl, label: '去水印' },
              ].map(image => (
                <div
                  key={image.label}
                  className="glass-card overflow-hidden rounded-xl border-border"
                >
                  <div className="flex items-center justify-between border-b border-border/60 bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{image.label}</span>
                  </div>
                  <img
                    src={image.url}
                    alt={image.label}
                    className="w-full object-contain"
                    style={{ aspectRatio }}
                  />
                </div>
              ))}
            </div>
          )}

      {viewer.upscaleError && (
        <Alert variant="destructive">
          <AlertIcon />
          <AlertContent>
            <AlertDescription>{viewer.upscaleError}</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
        <MotionButton
          variant="primary"
          size="lg"
          className="gap-2 rounded-xl"
          disabled={viewer.isUpscaling}
          onClick={viewer.handleDownload}
        >
          <Download className="size-4" />
          <span>下载</span>
        </MotionButton>

        {viewer.isUpscaled
          ? (
              <MotionButton
                variant="outline"
                size="lg"
                className="gap-2 rounded-xl text-foreground"
                onClick={viewer.handleRevertUpscale}
              >
                <Undo2 className="size-4" />
                <span>撤销增强</span>
              </MotionButton>
            )
          : (
              <MotionButton
                variant="secondary"
                size="lg"
                className="gap-2 rounded-xl"
                disabled={viewer.isUpscaling}
                onClick={() => void viewer.handleUpscale()}
              >
                {viewer.isUpscaling
                  ? (
                      <Loader variant="spinner" size={16} />
                    )
                  : (
                      <Sparkles className="size-4 text-foreground" />
                    )}
                <span>{viewer.isUpscaling ? '增强中…' : '超清放大'}</span>
              </MotionButton>
            )}

        <MotionButton
          variant="ghost"
          size="lg"
          className="gap-2 rounded-xl text-muted-foreground hover:text-foreground"
          disabled={viewer.isUpscaling}
          onClick={props.onReset}
        >
          <RotateCcw className="size-4" />
          <span>换一张</span>
        </MotionButton>
      </div>
    </div>
  )
}
