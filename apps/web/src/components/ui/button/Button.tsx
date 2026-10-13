import type { ComponentProps } from 'react'
import type { ButtonVariants } from '.'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'
import { buttonVariants } from '.'

export type ButtonProps = ComponentProps<'button'> & ButtonVariants & { asChild?: boolean }

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
