import { ImagePlus, Loader2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  isProcessing: boolean
  canProcess: boolean
  hasImage: boolean
  processLabel: string
  onProcess: () => void
  onReset: () => void
}
export default function ActionBar({
  isProcessing,
  canProcess,
  hasImage,
  processLabel,
  onProcess,
  onReset
}: Props) {
  if (!hasImage) return null
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 border-t border-border bg-background/80 px-4 py-3 backdrop-blur-xl md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
      style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}
    >
      <Button
        variant="outline"
        disabled={isProcessing}
        className="h-11 gap-2 rounded-xl"
        aria-label="上传新图片"
        onClick={onReset}
      >
        <ImagePlus className="size-4" />
        <span className="hidden md:inline">新图片</span>
      </Button>
      <Button
        disabled={!canProcess || isProcessing}
        className="gradient-btn h-11 flex-1 gap-2 rounded-xl md:flex-none md:px-8"
        onClick={onProcess}
      >
        {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
        {isProcessing ? '正在处理…' : processLabel}
      </Button>
    </div>
  )
}
