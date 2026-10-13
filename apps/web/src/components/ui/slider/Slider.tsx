import { InlineSlider } from '@/components/motion/inline-slider'
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
  /** 内联标签，例如 "画笔大小"、"Icon size"；传入时将渲染为 beUI 官网同款一体化内联滑块 */
  'label'?: string
  /** 格式化内联显示的数值，例如 (v) => `${v}px` */
  'format'?: (value: number) => string
  /** 强制指定滑块样式变体：'inline'（带内嵌标签与读数）或 'default'（纯刻度滑块） */
  'variant'?: 'default' | 'inline'
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
  showTicks = true,
  label,
  format,
  variant,
}: SliderProps) {
  const numValue = Array.isArray(value) ? value[0] : value
  const numDefault = Array.isArray(defaultValue) ? defaultValue[0] : defaultValue

  const handleChange = (val: number) => {
    onValueChange?.([val])
  }

  const isInline = variant === 'inline' || (variant === undefined && label !== undefined)

  if (isInline) {
    return (
      <div className={cn('w-full', className)}>
        <InlineSlider
          label={label ?? ''}
          value={numValue}
          defaultValue={numDefault}
          onValueChange={handleChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-label={ariaLabel}
          showTicks={showTicks}
          format={format}
        />
      </div>
    )
  }

  return (
    <div className={cn('flex items-center w-full', className)}>
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
