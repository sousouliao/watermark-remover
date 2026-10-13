import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { PROCESSING_STEPS } from '@/constants/processing'

export default function ProcessingOverlay() {
  const [currentStep, setCurrentStep] = useState(0)
  useEffect(() => {
    const interval = setInterval(
      () => setCurrentStep((value) => Math.min(value + 1, PROCESSING_STEPS.length - 1)),
      3000
    )
    return () => clearInterval(interval)
  }, [])
  return (
    <div
      className="glass-card animate-fade-in flex w-72 flex-col items-center gap-6 rounded-2xl p-8 md:w-80 md:p-12"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-16 animate-spin text-primary" aria-hidden="true" />
      <Progress value={null} className="h-1.5" aria-label="正在处理图片" />
      <p className="text-center text-sm font-medium">{PROCESSING_STEPS[currentStep]}</p>
      <div className="flex gap-1" aria-hidden="true">
        {PROCESSING_STEPS.map((label, index) => (
          <span
            key={label}
            className={`h-1 rounded-full transition-all ${index <= currentStep ? 'bg-primary' : 'bg-muted-foreground/30'} ${index === currentStep ? 'w-3' : 'w-1'}`}
          />
        ))}
      </div>
    </div>
  )
}
