import { type ComponentProps, forwardRef } from 'react'
import { Input as MotionInput, type InputProps as MotionInputProps } from '@/components/motion/input'
import { cn } from '@/lib/utils'

export type InputProps = ComponentProps<'input'> & Partial<Omit<MotionInputProps, keyof ComponentProps<'input'>>>

export const Input = forwardRef<HTMLInputElement, InputProps>((
  { className, type, ...props },
  ref,
) => {
  // If it's a hidden or file input, keep clean DOM without decoration
  if (type === 'file' || className?.includes('sr-only')) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn('flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm', className)}
        {...props}
      />
    )
  }

  // Otherwise, use beUI Motion Input
  return (
    <MotionInput
      ref={ref}
      type={type}
      className={className}
      {...(props as any)}
    />
  )
})
