import type { Ref } from 'react'
import type { Region } from '@/types/mask'
import { Trash2, Undo2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useImperativeHandle } from 'react'
import { MotionButton } from '@/components/motion/button'
import { Slider } from '@/components/ui/slider'
import { EASE_OUT } from '@/lib/ease'
import { cn } from '@/lib/utils'
import { useMaskEditor } from './hooks/useMaskEditor'

export interface MaskEditorHandle {
  getRegion: () => Region | null
}

export default function MaskEditor({
  imageDataUrl,
  mode = 'region',
  ref,
}: {
  imageDataUrl: string
  mode?: 'direct' | 'region'
  ref?: Ref<MaskEditorHandle>
}) {
  const isRegionMode = mode === 'region'
  const editor = useMaskEditor(imageDataUrl)
  const { canvasSize, brushSize, cursor } = editor
  useImperativeHandle(ref, () => ({ getRegion: editor.getRegion }), [editor.getRegion])

  return (
    <div
      ref={editor.containerRef}
      className="flex w-full justify-center overflow-hidden"
    >
      <div
        className="relative overflow-hidden rounded-2xl border border-border/80 bg-muted/20"
        style={{ width: canvasSize.width || '100%', height: canvasSize.height || 300 }}
      >
        <canvas ref={editor.imageCanvasRef} className="absolute inset-0" />
        <canvas
          ref={editor.maskCanvasRef}
          className={cn(
            'absolute inset-0 touch-none',
            isRegionMode ? 'cursor-none' : 'pointer-events-none',
          )}
          role="img"
          aria-label={isRegionMode ? '使用鼠标或手指涂抹水印区域' : '原图展示'}
          onPointerDown={isRegionMode ? editor.handlePointerDown : undefined}
          onPointerMove={isRegionMode ? editor.handlePointerMove : undefined}
          onPointerUp={isRegionMode ? editor.handlePointerUp : undefined}
          onPointerCancel={isRegionMode ? editor.handlePointerUp : undefined}
          onLostPointerCapture={isRegionMode ? editor.handlePointerUp : undefined}
          onPointerEnter={isRegionMode ? () => editor.setIsHovering(true) : undefined}
          onPointerLeave={isRegionMode ? () => editor.setIsHovering(false) : undefined}
        />

        {/* Hover Brush Outline Indicator (Only in region mode) */}
        {isRegionMode && editor.isHovering && !editor.isDrawing && (
          <div
            className="pointer-events-none absolute rounded-full border border-white outline outline-1 outline-black/60"
            style={{
              width: brushSize[0],
              height: brushSize[0],
              left: cursor.x,
              top: cursor.y,
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
            }}
          />
        )}

        {/* Floating Brush Control HUD (Anchored inside canvas bottom) */}
        <AnimatePresence>
          {isRegionMode && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className="pointer-events-auto absolute bottom-3.5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 sm:gap-2.5 rounded-full border border-border/90 bg-background/95 px-3 py-1.5 shadow-lg backdrop-blur-xl select-none max-w-[calc(100%-24px)]"
            >
              {/* Brush tip size preview */}
              <div
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/60"
                title={`画笔直径：${brushSize[0]}px`}
                aria-hidden="true"
              >
                <span
                  className="rounded-full bg-foreground transition-all duration-150"
                  style={{
                    width: Math.max(3, Math.min(brushSize[0] * 0.45, 18)),
                    height: Math.max(3, Math.min(brushSize[0] * 0.45, 18)),
                  }}
                />
              </div>

              {/* Responsive inline slider */}
              <Slider
                variant="inline"
                label="画笔大小"
                className="w-32 sm:w-44 md:w-56 shrink min-w-20"
                value={brushSize}
                onValueChange={editor.setBrushSize}
                min={4}
                max={60}
                step={2}
                format={val => `${val}px`}
                aria-label="画笔大小"
              />

              <div className="h-4 w-px bg-border/80 shrink-0" />

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <MotionButton
                  variant="secondary"
                  size="sm"
                  disabled={!editor.hasMaskStrokes}
                  aria-label="撤销上一笔涂抹"
                  onClick={editor.handleUndo}
                  className="h-7 px-2.5 sm:px-3 text-xs font-medium rounded-full gap-1 shrink-0 shadow-none"
                >
                  <Undo2 className="size-3.5 shrink-0" />
                  <span>撤销</span>
                </MotionButton>

                <MotionButton
                  variant="secondary"
                  size="sm"
                  disabled={!editor.hasMaskStrokes}
                  aria-label="清空所有涂抹标记"
                  onClick={editor.handleClear}
                  className="h-7 px-2.5 sm:px-3 text-xs font-medium rounded-full gap-1 shrink-0 shadow-none hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                >
                  <Trash2 className="size-3.5 shrink-0" />
                  <span>清空</span>
                </MotionButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
