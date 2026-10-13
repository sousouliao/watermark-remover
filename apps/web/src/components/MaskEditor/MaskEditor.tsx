import type { Ref } from 'react'
import type { Region } from '@/types/mask'
import { Minus, Paintbrush, Plus, Trash2, Undo2 } from 'lucide-react'
import { useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { useMaskEditor } from './hooks/useMaskEditor'

export interface MaskEditorHandle {
  getRegion: () => Region | null
}

export default function MaskEditor({
  imageDataUrl,
  ref,
}: {
  imageDataUrl: string
  ref?: Ref<MaskEditorHandle>
}) {
  const editor = useMaskEditor(imageDataUrl)
  const { canvasSize, brushSize, cursor } = editor
  useImperativeHandle(ref, () => ({ getRegion: editor.getRegion }), [editor.getRegion])

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="ghost"
        size="sm"
        className="self-start md:hidden"
        aria-expanded={editor.showToolbar}
        aria-controls="mask-toolbar"
        onClick={() => editor.setShowToolbar(value => !value)}
      >
        <Paintbrush className="mr-2 size-4" />
        画笔工具
      </Button>

      <Card
        id="mask-toolbar"
        className={`glass-card border-border/70 p-2.5 ${
          editor.showToolbar ? 'block' : 'hidden md:block'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-secondary/80"
              aria-hidden="true"
            >
              <span
                className="rounded-full bg-foreground"
                style={{
                  width: Math.max(4, Math.min(brushSize[0] * 0.5, 24)),
                  height: Math.max(4, Math.min(brushSize[0] * 0.5, 24)),
                }}
              />
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="size-7 shrink-0 rounded-lg"
              aria-label="减小画笔"
              onClick={() => editor.setBrushSize([Math.max(4, brushSize[0] - 4)])}
            >
              <Minus className="size-3" />
            </Button>

            <Slider
              className="min-w-20 max-w-44 flex-1"
              value={brushSize}
              onValueChange={editor.setBrushSize}
              min={4}
              max={60}
              step={2}
              aria-label="画笔大小"
            />

            <Button
              size="icon"
              variant="ghost"
              className="size-7 shrink-0 rounded"
              aria-label="增大画笔"
              onClick={() => editor.setBrushSize([Math.min(60, brushSize[0] + 4)])}
            >
              <Plus className="size-3" />
            </Button>

            <span className="w-10 text-center font-mono text-xs text-muted-foreground">
              {brushSize[0]}
              px
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-md text-xs"
              disabled={!editor.hasMaskStrokes}
              aria-label="撤销上一笔"
              onClick={editor.handleUndo}
            >
              <Undo2 className="mr-1 size-3.5" />
              <span>撤销</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-xs text-destructive hover:border-destructive/30 hover:bg-destructive/10"
              disabled={!editor.hasMaskStrokes}
              aria-label="清除所有标记"
              onClick={editor.handleClear}
            >
              <Trash2 className="mr-1 size-3.5" />
              <span>清除</span>
            </Button>
          </div>
        </div>
      </Card>

      <div
        ref={editor.containerRef}
        className="glass-card relative overflow-hidden rounded-2xl border-border/80"
      >
        <div
          className="relative mx-auto"
          style={{ width: canvasSize.width || '100%', height: canvasSize.height || 300 }}
        >
          <canvas ref={editor.imageCanvasRef} className="absolute inset-0" />
          <canvas
            ref={editor.maskCanvasRef}
            className="absolute inset-0 cursor-none touch-none"
            role="img"
            aria-label="使用鼠标或手指涂抹水印区域"
            onPointerDown={editor.handlePointerDown}
            onPointerMove={editor.handlePointerMove}
            onPointerUp={editor.handlePointerUp}
            onPointerCancel={editor.handlePointerUp}
            onLostPointerCapture={editor.handlePointerUp}
            onPointerEnter={() => editor.setIsHovering(true)}
            onPointerLeave={() => editor.setIsHovering(false)}
          />
          {editor.isHovering && !editor.isDrawing && (
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
        </div>
      </div>
    </div>
  )
}
