import type { WatermarkModel } from '@/types/app'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { AnimatedBadge } from '@/components/motion/animated-badge'
import { MotionButton } from '@/components/motion/button'
import { Loader } from '@/components/motion/loader'
import { ReasoningText } from '@/components/motion/reasoning-text'
import { PROCESSING_STEPS } from '@/constants/processing'
import { cn } from '@/lib/utils'

export interface ProcessingOverlayProps {
  imageDataUrl?: string | null
  model?: WatermarkModel | null
  onCancel?: () => void
  className?: string
}

export default function ProcessingOverlay({
  imageDataUrl,
  model = 'lite',
  onCancel,
  className,
}: ProcessingOverlayProps) {
  const reduce = useReducedMotion() ?? false
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = performance.now()
    const timer = window.setInterval(() => {
      setElapsed((performance.now() - start) / 1000)
    }, 100)
    return () => window.clearInterval(timer)
  }, [])

  const modelLabel = model === 'flash' ? 'Seedream 5.0 Flash' : 'Seedream 5.0 Lite'

  const hudCard = (
    <div className="flex w-full max-w-[19rem] flex-col items-center gap-4 rounded-2xl border border-border bg-background/95 p-5 backdrop-blur-xl sm:max-w-sm sm:p-6">
      {/* Top Meta Header: Model Badge & Elapsed Timer */}
      <div className="flex w-full items-center justify-between gap-2 border-b border-border/40 pb-3">
        <AnimatedBadge
          status="neutral"
          size="sm"
          icon={<span className="size-1.5 rounded-full bg-foreground/80 animate-pulse" />}
          pulse
          className="text-[11px]"
        >
          {modelLabel}
        </AnimatedBadge>

        <span
          aria-label={`已处理 ${elapsed.toFixed(1)} 秒`}
          className="font-mono text-xs tabular-nums text-muted-foreground"
        >
          {elapsed.toFixed(1)}
          s
        </span>
      </div>

      {/* Center Animation: Dot-Matrix Loader */}
      <div className="relative flex size-13 items-center justify-center rounded-2xl border border-border/80 bg-muted/40">
        <Loader variant="dot-matrix" size={24} className="text-foreground" />
      </div>

      {/* Dynamic Step Text with Shimmer Sweep */}
      <div className="flex min-h-6 items-center justify-center text-center">
        <ReasoningText
          phrases={[...PROCESSING_STEPS]}
          variant="swap"
          interval={2800}
          indicator={<span className="size-1.5 rounded-full bg-foreground/60 shrink-0" />}
          className="text-xs font-medium text-foreground sm:text-sm"
        />
      </div>

      {/* Hairline Stream Progress Indicator */}
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted/70">
        <motion.div
          aria-hidden="true"
          className="absolute inset-y-0 w-1/3 rounded-full bg-foreground"
          animate={
            reduce
              ? { opacity: [0.35, 0.95, 0.35] }
              : {
                  left: ['-35%', '100%'],
                }
          }
          transition={{
            duration: 1.6,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Inline Cancel Action */}
      {onCancel && (
        <MotionButton
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-7 text-xs text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
        >
          取消处理
        </MotionButton>
      )}
    </div>
  )

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('relative flex w-full justify-center', className)}
    >
      {imageDataUrl
        ? (
            <div className="relative flex max-h-[min(54vh,calc(100svh-270px))] w-fit items-center justify-center overflow-hidden rounded-2xl border border-border/80 bg-muted/20">
              {/* Workspace Background Image */}
              <img
                src={imageDataUrl}
                alt="正在处理的原图"
                className="block max-h-[min(54vh,calc(100svh-270px))] max-w-full w-auto h-auto object-contain opacity-60 filter blur-[1.5px]"
              />

              {/* Neural Laser Scanning Wave */}
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 h-32 bg-gradient-to-b from-transparent via-foreground/[0.07] to-transparent"
                initial={{ top: '-30%' }}
                animate={reduce ? undefined : { top: '130%' }}
                transition={{
                  duration: 2.6,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: 'easeInOut',
                }}
              />

              {/* Darkroom Atmosphere Mask */}
              <div className="absolute inset-0 bg-background/50 backdrop-blur-[3px]" />

              {/* Floating Center HUD */}
              <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
                {hudCard}
              </div>
            </div>
          )
        : (
            hudCard
          )}
    </div>
  )
}
