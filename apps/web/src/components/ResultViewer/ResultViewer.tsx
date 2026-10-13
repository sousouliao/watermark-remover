import type { CSSProperties } from 'react'
import { Columns2, Download, GripVertical, Loader2, RotateCcw, Sparkles, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">结果预览</p>
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {(['slider', 'side-by-side'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={viewMode === mode}
              className={cn(
                'flex items-center gap-1 rounded-md px-3 py-1 text-xs',
                viewMode === mode
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              )}
              onClick={() => viewer.setViewMode(mode)}
            >
              {mode === 'slider' ? (
                '滑动对比'
              ) : (
                <>
                  <Columns2 className="size-3" />
                  并排对比
                </>
              )}
            </button>
          ))}
        </div>
      </div>
      {viewMode === 'slider' ? (
        <div
          ref={viewer.containerRef}
          className={cn(
            'glass-card relative max-h-[70vh] touch-none cursor-col-resize select-none overflow-hidden rounded-2xl',
            viewer.isDragging && 'is-dragging'
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
          <div
            className="absolute inset-y-0 z-10 flex w-0.5 items-center justify-center bg-background/90 shadow-lg"
            style={{ left: 'calc(var(--slider-pct) * 1%)', transform: 'translateX(-50%)' }}
          >
            <div className="absolute flex h-10 w-6 items-center justify-center rounded-full bg-background shadow-lg ring-1 ring-border">
              <GripVertical className="size-4 text-muted-foreground" />
            </div>
          </div>
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-foreground/70 px-3 py-1 text-xs text-background">
            原图
          </span>
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-primary/80 px-3 py-1 text-xs text-primary-foreground">
            结果
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { url: props.originalUrl, label: '原图' },
            { url: props.resultUrl, label: '结果' }
          ].map((image) => (
            <div key={image.label} className="glass-card overflow-hidden rounded-2xl">
              <p className="bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                {image.label}
              </p>
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
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {viewer.upscaleError}
        </p>
      )}
      <div className="flex flex-col justify-center gap-2 sm:flex-row">
        <Button
          className="gradient-btn gap-2 rounded-xl"
          disabled={viewer.isUpscaling}
          onClick={viewer.handleDownload}
        >
          <Download className="size-4" />
          下载结果
        </Button>
        {viewer.isUpscaled ? (
          <Button
            variant="outline"
            className="gap-2 rounded-xl text-amber-600 dark:text-amber-400"
            onClick={viewer.handleRevertUpscale}
          >
            <Undo2 className="size-4" />
            撤销增强
          </Button>
        ) : (
          <Button
            variant="outline"
            className="gap-2 rounded-xl text-violet-600 dark:text-violet-400"
            disabled={viewer.isUpscaling}
            onClick={() => void viewer.handleUpscale()}
          >
            {viewer.isUpscaling ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {viewer.isUpscaling ? '正在增强…' : '高清增强'}
          </Button>
        )}
        <Button
          variant="outline"
          className="gap-2 rounded-xl"
          disabled={viewer.isUpscaling}
          onClick={props.onReset}
        >
          <RotateCcw className="size-4" />
          换一张图片
        </Button>
      </div>
    </div>
  )
}
