import type { ReactNode, Ref } from 'react'
import type { Region } from '@/types/mask'
import { Trash2, Undo2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useImperativeHandle } from 'react'
import { Button } from '@/components/motion/button/base'
import { EASE_OUT, SPRING_LAYOUT } from '@/lib/ease'
import { cn } from '@/lib/utils'
import { useMaskEditor } from './hooks/useMaskEditor'

export interface MaskEditorHandle {
  getRegion: () => Region | null
}

// 画笔直径（屏幕像素）与按钮内圆点的示意尺寸。
const BRUSH_SIZES = [
  { size: 12, dot: 4, label: '细' },
  { size: 24, dot: 7, label: '中' },
  { size: 40, dot: 11, label: '粗' },
  { size: 60, dot: 15, label: '特粗' },
] as const

export default function MaskEditor({
  imageDataUrl,
  mode = 'region',
  start,
  end,
  ref,
}: {
  imageDataUrl: string
  mode?: 'direct' | 'region'
  /** 画布下方操作行的左右两端；涂抹模式下画笔工具位于中间。 */
  start?: ReactNode
  end?: ReactNode
  ref?: Ref<MaskEditorHandle>
}) {
  const isRegionMode = mode === 'region'
  const editor = useMaskEditor(imageDataUrl)
  const { canvasSize, brushSize, cursor } = editor
  const reduce = useReducedMotion()
  useImperativeHandle(ref, () => ({ getRegion: editor.getRegion }), [editor.getRegion])

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={editor.containerRef}
        className="flex w-full justify-center overflow-hidden"
      >
        <div
          className="relative overflow-hidden rounded-2xl border border-border bg-muted/20"
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

          {isRegionMode && editor.isHovering && !editor.isDrawing && (
            <div
              className="pointer-events-none absolute rounded-full border border-white outline-1 outline-black/60"
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
        </div>
      </div>

      {/* 窄屏时画笔工具单独占一行并排在最前；宽屏三栏，工具始终居中 */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr]">
        <div className="sm:justify-self-start">{start}</div>

        <AnimatePresence initial={false}>
          {isRegionMode && (
            <motion.div
              key="brush-tools"
              initial={{ opacity: 0, filter: reduce ? 'none' : 'blur(3px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: reduce ? 'none' : 'blur(3px)' }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className="order-first flex w-full items-center justify-center gap-2 sm:order-none sm:w-auto"
            >
              <div role="radiogroup" aria-label="画笔大小" className="flex items-center gap-1 rounded-full bg-muted p-1">
                {BRUSH_SIZES.map(({ size, dot, label }) => {
                  const selected = brushSize[0] === size
                  return (
                    <button
                      key={size}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${label}画笔，${size}px`}
                      title={`${label}画笔，${size}px`}
                      onClick={() => editor.setBrushSize([size])}
                      className={cn(
                        'relative grid size-8 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
                        selected ? 'text-background' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {selected && (
                        <motion.span
                          layoutId="brush-size-indicator"
                          transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
                          className="absolute inset-0 rounded-full bg-foreground"
                        />
                      )}
                      <span
                        className="relative rounded-full bg-current"
                        style={{ width: dot, height: dot }}
                      />
                    </button>
                  )
                })}
              </div>

              <Button
                variant="ghost"
                size="icon"
                disabled={!editor.hasMaskStrokes}
                aria-label="撤销上一笔"
                title="撤销上一笔"
                onClick={editor.handleUndo}
              >
                <Undo2 className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={!editor.hasMaskStrokes}
                aria-label="清空涂抹"
                title="清空涂抹"
                onClick={editor.handleClear}
              >
                <Trash2 className="size-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="sm:col-start-3 sm:justify-self-end">{end}</div>
      </div>
    </div>
  )
}
