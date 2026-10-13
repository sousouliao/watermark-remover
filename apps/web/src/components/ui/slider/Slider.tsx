import { RangeSlider } from '@/components/motion/range-slider'
import { cn } from '@/lib/utils'

export interface SliderProps {
  'className'?: string
  'value'?: number[] | number
  'defaultValue'?: number[] | number
  'onValueChange'?: (value: number[]) => void
  'min'?: number
  'max'?: number
  'step'?: number
  'disabled'?: boolean
  'aria-label'?: string
  'showTicks'?: boolean
}

export function Slider({
  className,
  value,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  'aria-label': ariaLabel,
  showTicks = false,
}: SliderProps) {
  const numValue = Array.isArray(value) ? value[0] : value
  const numDefault = Array.isArray(defaultValue) ? defaultValue[0] : defaultValue

  const handleChange = (val: number) => {
    onValueChange?.([val])
  }

  return (
    <div className={cn('flex items-center', className)}>
      <RangeSlider
        value={numValue}
        defaultValue={numDefault}
        onValueChange={handleChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        showTicks={showTicks}
      />
    </div>
  )
}
