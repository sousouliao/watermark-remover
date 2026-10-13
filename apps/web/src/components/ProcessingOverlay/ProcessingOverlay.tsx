import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Loader } from '@/components/motion/loader'
import { Progress } from '@/components/ui/progress'
import { PROCESSING_STEPS } from '@/constants/processing'

export default function ProcessingOverlay() {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(
      () => setCurrentStep(value => Math.min(value + 1, PROCESSING_STEPS.length - 1)),
      3000,
    )
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="flex w-72 flex-col items-center gap-5 rounded-2xl border border-border bg-background p-6 md:w-80 md:p-8"
      role="status"
      aria-live="polite"
    >
      <div className="relative flex size-12 items-center justify-center rounded-xl border border-border bg-muted/40">
        <Loader variant="dot-matrix" size={24} className="text-foreground" />
      </div>

      <div className="w-full">
        <Progress value={null} className="h-1 bg-muted" aria-label="正在处理图片" />
      </div>

      <div className="min-h-5 text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={currentStep}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-xs font-medium text-foreground md:text-sm"
          >
            {PROCESSING_STEPS[currentStep]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="flex gap-1.5" aria-hidden="true">
        {PROCESSING_STEPS.map((label, index) => (
          <span
            key={label}
            className={`h-1 rounded-full transition-all duration-300 ${
              index <= currentStep ? 'bg-foreground' : 'bg-muted-foreground/20'
            } ${index === currentStep ? 'w-4' : 'w-1'}`}
          />
        ))}
      </div>
    </div>
  )
}
