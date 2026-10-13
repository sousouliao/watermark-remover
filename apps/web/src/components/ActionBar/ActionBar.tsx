import { ImagePlus, Sparkles } from 'lucide-react'
import { MotionButton, StatefulButton } from '@/components/motion/button'

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
  onReset,
}: Props) {
  if (!hasImage) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-center border-t border-border/60 bg-background/85 px-4 py-3 backdrop-blur-xl md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
      style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}
    >
      <div className="flex w-full max-w-md items-center justify-center gap-3">
        <MotionButton
          variant="secondary"
          size="lg"
          disabled={isProcessing}
          className="gap-2 rounded-xl text-xs font-medium md:text-sm"
          aria-label="上传新图片"
          onClick={onReset}
        >
          <ImagePlus className="size-4 text-muted-foreground" />
          <span>换一张</span>
        </MotionButton>

        <StatefulButton
          state={isProcessing ? 'loading' : 'idle'}
          disabled={!canProcess || isProcessing}
          variant="primary"
          size="lg"
          className="flex-1 gap-2 rounded-xl text-xs font-medium md:flex-none md:min-w-44 md:text-sm"
          icon={<Sparkles className="size-4" />}
          loadingText="处理中…"
          onClick={onProcess}
        >
          {processLabel}
        </StatefulButton>
      </div>
    </div>
  )
}
