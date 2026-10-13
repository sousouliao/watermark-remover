import type { ComponentProps } from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

export function Slider({ className, value, defaultValue = [0], ...props }: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root className={cn('relative flex w-full touch-none select-none items-center', className)} value={value} defaultValue={defaultValue} {...props}>
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {(value ?? defaultValue).map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  )
}
