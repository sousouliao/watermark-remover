import type { ComponentProps } from 'react'
import { Button as MotionButton, type ButtonProps as MotionButtonProps } from '@/components/motion/button'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'default' | 'primary' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
export type ButtonSize = 'default' | 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends Omit<ComponentProps<'button'>, 'children' | 'ref'> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
  children?: React.ReactNode
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  children,
  ...props
}: ButtonProps) {
  // Map shadcn legacy variant to beUI variant
  let beuiVariant: MotionButtonProps['variant'] = 'primary'
  let customClass = ''

  if (variant === 'destructive') {
    beuiVariant = 'primary'
    customClass = 'bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive'
  }
  else if (variant === 'outline') {
    beuiVariant = 'outline'
  }
  else if (variant === 'secondary') {
    beuiVariant = 'secondary'
  }
  else if (variant === 'ghost') {
    beuiVariant = 'ghost'
  }
  else if (variant === 'link') {
    beuiVariant = 'ghost'
    customClass = 'underline-offset-4 hover:underline'
  }

  const beuiSize: MotionButtonProps['size'] = size === 'default' ? 'md' : size === 'icon' ? 'icon' : size === 'lg' ? 'lg' : 'sm'

  return (
    <MotionButton
      variant={beuiVariant}
      size={beuiSize}
      className={cn(customClass, className)}
      {...(props as any)}
    >
      {children}
    </MotionButton>
  )
}
