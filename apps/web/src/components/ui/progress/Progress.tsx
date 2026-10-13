import type { ComponentProps } from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/lib/utils'

export function Progress({
  className,
  value = 0,
  max = 100,
  ...props
}: ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      className={cn('relative h-4 w-full overflow-hidden rounded-full bg-secondary', className)}
      value={value}
      max={max}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'h-full w-full flex-1 bg-primary transition-all',
          value === null && 'w-2/5 animate-indeterminate'
        )}
        style={
          value === null ? undefined : { transform: `translateX(-${100 - (value / max) * 100}%)` }
        }
      />
    </ProgressPrimitive.Root>
  )
}
