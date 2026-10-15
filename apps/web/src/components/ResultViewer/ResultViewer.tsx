import type { CSSProperties } from 'react'
import type { LightboxImage } from '@/components/motion/morphing-lightbox'
import { Columns2, Download, GripVertical, RotateCcw, SlidersHorizontal, Undo2, ZoomIn } from 'lucide-react'
import { useEffect, useState } from 'react'
import FloatingAlert from '@/components/FloatingAlert/FloatingAlert'
import { Button } from '@/components/motion/button/base'
import { StatefulButton } from '@/components/motion/button/stateful'
import { ImageViewer, ImageViewerContent, ImageViewerThumbnail } from '@/components/motion/morphing-lightbox'
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
  const compareImages = [
    { id: 'original', src: props.originalUrl, alt: '原图' },
    { id: 'result', src: props.resultUrl, alt: '结果' },
  ]
  const [naturalSizes, setNaturalSizes] = useState<Record<string, { width: number, height: number }>>({})

  // 预览需要图片的真实尺寸；读到之前缩略图退回普通图片
  useEffect(() => {
    let cancelled = false
    const images = [
      { id: 'original', src: props.originalUrl },
      { id: 'result', src: props.resultUrl },
    ]
    setNaturalSizes({})
    for (const { id, src } of images) {
      const img = new Image()
      img.onload = () => {
        if (cancelled) return
        setNaturalSizes(previous => ({
          ...previous,
          [id]: { width: img.naturalWidth, height: img.naturalHeight },
        }))
      }
      img.src = src
    }
    return () => {
      cancelled = true
    }
  }, [props.originalUrl, props.resultUrl])

  const previewImages: LightboxImage[] = compareImages.flatMap(image =>
    naturalSizes[image.id] ? [{ ...image, ...naturalSizes[image.id] }] : [],
  )

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      {/* 滑动与并排共用同一尺寸的舞台，切换时下方操作行位置不变 */}
      <div className="relative max-h-[70vh] w-full" style={{ aspectRatio }}>
        {viewMode === 'slider'
          ? (
              <div
                ref={viewer.containerRef}
                className={cn(
                  'glass-card absolute inset-0 touch-none cursor-col-resize select-none overflow-hidden rounded-2xl border-border',
                  viewer.isDragging && 'is-dragging',
                )}
                style={{ '--slider-pct': viewer.sliderPosition } as CSSProperties}
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
                  className="absolute inset-y-0 z-10 flex w-0.5 items-center justify-center bg-white"
                  style={{ left: 'calc(var(--slider-pct) * 1%)', transform: 'translateX(-50%)' }}
                >
                  <div className="absolute flex h-9 w-6 items-center justify-center rounded-full border border-black/20 bg-white text-black">
                    <GripVertical className="size-3.5" />
                  </div>
                </div>
              </div>
            )
          : (
              <ImageViewer images={previewImages} label="原图与结果预览">
                <div className="absolute inset-0 grid grid-rows-2 gap-3 sm:grid-cols-2 sm:grid-rows-1">
                  {compareImages.map(image => (
                    <figure key={image.id} className="flex min-h-0 flex-col gap-2">
                      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-muted/20">
                        {previewImages.some(item => item.id === image.id)
                          ? (
                              <ImageViewerThumbnail
                                imageId={image.id}
                                className="size-full"
                                imageClassName="size-full object-contain"
                              />
                            )
                          : (
                              <img src={image.src} alt={image.alt} className="size-full object-contain" />
                            )}
                      </div>
                      <figcaption className="text-center text-sm text-muted-foreground">
                        {image.alt}
                      </figcaption>
                    </figure>
                  ))}
                </div>
                <ImageViewerContent />
              </ImageViewer>
            )}
      </div>

      <FloatingAlert message={viewer.upscaleError} onDismiss={() => viewer.setUpscaleError(null)} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={viewer.isUpscaling} onClick={props.onReset}>
            <RotateCcw className="size-4" />
            换一张
          </Button>

          <Tabs
            value={viewMode}
            onValueChange={val => viewer.setViewMode(val as 'slider' | 'side-by-side')}
            variant="pill"
          >
            <TabsList>
              <TabsTrigger value="slider" className="gap-1.5">
                <SlidersHorizontal className="size-3.5" />
                <span>滑动</span>
              </TabsTrigger>
              <TabsTrigger value="side-by-side" className="gap-1.5">
                <Columns2 className="size-3.5" />
                <span>并排</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2">
          {viewer.isUpscaled
            ? (
                <Button variant="outline" onClick={viewer.handleRevertUpscale}>
                  <Undo2 className="size-4" />
                  撤销放大
                </Button>
              )
            : (
                <StatefulButton
                  variant="outline"
                  state={viewer.isUpscaling ? 'loading' : 'idle'}
                  loadingText="放大中"
                  icon={<ZoomIn className="size-4" />}
                  onClick={() => void viewer.handleUpscale()}
                >
                  放大两倍
                </StatefulButton>
              )}

          <Button variant="primary" disabled={viewer.isUpscaling} onClick={viewer.handleDownload}>
            <Download className="size-4" />
            下载
          </Button>
        </div>
      </div>
    </div>
  )
}
