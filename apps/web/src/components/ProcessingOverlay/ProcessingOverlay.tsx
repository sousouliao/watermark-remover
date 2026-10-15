import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/motion/button/base'
import { Loader } from '@/components/motion/loader'
import { ReasoningText } from '@/components/motion/reasoning-text'
import { PROCESSING_STEPS } from '@/constants/processing'

export interface ProcessingOverlayProps {
  imageDataUrl: string
  onCancel: () => void
}

export default function ProcessingOverlay({ imageDataUrl, onCancel }: ProcessingOverlayProps) {
  const reduce = useReducedMotion() ?? false
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = performance.now()
    const timer = window.setInterval(() => {
      setElapsed((performance.now() - start) / 1000)
    }, 100)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div role="status" aria-live="polite" className="flex w-full flex-col items-center gap-4">
      <div className="relative flex w-fit max-w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/20">
        <img
          src={imageDataUrl}
          alt="正在处理的原图"
          className="block h-auto max-h-[min(54vh,calc(100svh-300px))] w-auto max-w-full object-contain opacity-50 blur-[2px]"
        />

        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 h-32 bg-linear-to-b from-transparent via-foreground/[0.07] to-transparent"
          initial={{ top: '-30%' }}
          animate={reduce ? undefined : { top: '130%' }}
          transition={{ duration: 2.6, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        />

        <div className="absolute inset-0 flex items-center justify-center">
          <Loader variant="dot-matrix" size={28} className="text-foreground" />
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm text-foreground">
        <ReasoningText
          phrases={[...PROCESSING_STEPS]}
          variant="swap"
          interval={2800}
          indicator={<span className="size-1.5 shrink-0 rounded-full bg-foreground/60" />}
        />
        <span
          aria-label={`已处理 ${elapsed.toFixed(0)} 秒`}
          className="tabular-nums text-muted-foreground"
        >
          {elapsed.toFixed(0)}
          秒
        </span>
      </div>

      <Button variant="ghost" onClick={onCancel}>取消处理</Button>
    </div>
  )
}
