import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { AnimatePresence, type HTMLMotionProps, motion, useReducedMotion } from 'motion/react'
import {
  type ComponentProps,
  createContext,
  type RefObject,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { EASE_OUT, EASE_OUT_CSS, SPRING_LAYOUT, SPRING_PRESS } from '@/lib/ease'
import { PresenceGate } from '@/lib/presence-gate'
import { cn } from '@/lib/utils'

export type AlertVariant = 'default' | 'info' | 'success' | 'warning' | 'destructive'

export interface AlertState {
  open: boolean
  variant: AlertVariant
  setOpen: (open: boolean) => void
  dismiss: () => void
}

const AlertContext = createContext<(AlertState & { reduce: boolean }) | null>(null)

function useAlertContext(component: string) {
  const context = useContext(AlertContext)
  if (!context) throw new Error(`${component} must be used within <Alert>`)
  return context
}

export function useAlert(): AlertState {
  return useAlertContext('useAlert')
}

const VARIANT_CLASS: Record<AlertVariant, string> = {
  default: 'border border-border bg-background text-foreground',
  info: 'border border-border bg-muted/40 text-foreground',
  success: 'border border-border bg-muted/40 text-foreground',
  warning: 'border border-border bg-muted/40 text-foreground',
  destructive: 'border border-destructive/40 bg-destructive/10 text-destructive',
}

const VARIANT_ICON = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  destructive: AlertCircle,
}

export interface AlertProps
  extends Omit<
    HTMLMotionProps<'div'>,
    'initial' | 'animate' | 'exit' | 'layout' | 'transition' | 'role'
  > {
  variant?: AlertVariant
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  returnFocusRef?: RefObject<HTMLElement | null>
  contentClassName?: string
  role?: 'alert' | 'status'
}

export function Alert({
  variant = 'default',
  open: controlledOpen,
  defaultOpen = true,
  onOpenChange,
  returnFocusRef,
  contentClassName,
  className,
  children,
  role = variant === 'warning' || variant === 'destructive' ? 'alert' : 'status',
  style,
  ref,
  ...props
}: AlertProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const open = controlledOpen ?? internalOpen
  const reduce = useReducedMotion() ?? false
  const surfaceRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ open, controlled: controlledOpen !== undefined, onOpenChange })

  useLayoutEffect(() => {
    stateRef.current = { open, controlled: controlledOpen !== undefined, onOpenChange }
  }, [controlledOpen, onOpenChange, open])

  const setOpen = useCallback((next: boolean) => {
    const state = stateRef.current
    if (next === state.open) return
    if (!state.controlled) {
      stateRef.current = { ...state, open: next }
      setInternalOpen(next)
    }
    state.onOpenChange?.(next)
  }, [])
  const dismiss = useCallback(() => setOpen(false), [setOpen])
  const context = useMemo(
    () => ({ open, variant, reduce, setOpen, dismiss }),
    [open, variant, reduce, setOpen, dismiss],
  )

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      surfaceRef.current = node
      const cleanup = typeof ref === 'function' ? ref(node) : undefined
      if (ref && typeof ref !== 'function') (ref as any).current = node
      if (!node) return
      return () => {
        surfaceRef.current = null
        if (typeof cleanup === 'function') cleanup()
        else if (typeof ref === 'function') ref(null)
        else if (ref) (ref as any).current = null
      }
    },
    [ref],
  )

  useLayoutEffect(() => {
    if (!open && surfaceRef.current?.contains(document.activeElement)) {
      returnFocusRef?.current?.focus({ preventScroll: true })
    }
  }, [open, returnFocusRef])

  return (
    <AlertContext.Provider value={context}>
      <AnimatePresence initial={false}>
        {open && (
          <PresenceGate key="alert">
            {({ gate, isPresent }) => (
              <motion.div
                {...props}
                {...gate}
                ref={setRef}
                role={role}
                aria-hidden={!isPresent || props['aria-hidden']}
                data-slot="alert"
                data-variant={variant}
                data-state={isPresent ? 'open' : 'closed'}
                initial={{ opacity: 0, transform: reduce ? 'none' : 'translateY(-6px)' }}
                animate={{ opacity: 1, transform: 'none' }}
                exit={{
                  opacity: 0,
                  transform: reduce ? 'none' : 'translateY(-6px)',
                  transition: { duration: 0.12, ease: EASE_OUT },
                }}
                layout={!reduce}
                transition={{
                  opacity: { duration: 0.18, ease: EASE_OUT },
                  transform: { duration: 0.2, ease: EASE_OUT },
                  layout: SPRING_LAYOUT,
                }}
                style={{ ...style, ...gate.style, originY: 0, transitionTimingFunction: EASE_OUT_CSS }}
                className={cn(
                  'relative w-full rounded-xl p-3 text-xs transition-colors duration-200',
                  VARIANT_CLASS[variant],
                  className,
                )}
              >
                <motion.div
                  layout={reduce ? false : 'position'}
                  transition={{ layout: SPRING_LAYOUT }}
                  style={{ originY: 0 }}
                  className={cn('flex min-w-0 items-start gap-2.5', contentClassName)}
                >
                  {children}
                </motion.div>
              </motion.div>
            )}
          </PresenceGate>
        )}
      </AnimatePresence>
    </AlertContext.Provider>
  )
}

export interface AlertIconProps extends ComponentProps<'span'> {}

export function AlertIcon({ className, children, ...props }: AlertIconProps) {
  const { variant, reduce } = useAlertContext('AlertIcon')
  const Icon = VARIANT_ICON[variant]
  return (
    <span
      {...props}
      aria-hidden="true"
      data-slot="alert-icon"
      className={cn('mt-0.5 inline-flex size-4 shrink-0 items-center justify-center', className)}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={variant}
          initial={{
            opacity: 0,
            transform: reduce ? 'translateY(0px) scale(1)' : 'translateY(4px) scale(0.9)',
          }}
          animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
          exit={{
            opacity: 0,
            transform: reduce ? 'translateY(0px) scale(1)' : 'translateY(-4px) scale(0.9)',
            transition: { duration: 0.1, ease: EASE_OUT },
          }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
          className="inline-flex [&>svg]:size-4"
        >
          {children ?? <Icon />}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

export interface AlertContentProps extends ComponentProps<'div'> {}

export function AlertContent({ className, ...props }: AlertContentProps) {
  return (
    <div
      {...props}
      data-slot="alert-content"
      className={cn('min-w-0 flex-1 space-y-0.5', className)}
    />
  )
}

export interface AlertTitleProps extends ComponentProps<'div'> {}

export function AlertTitle({ className, ...props }: AlertTitleProps) {
  return (
    <div
      {...props}
      data-slot="alert-title"
      className={cn('font-medium leading-5 text-pretty', className)}
    />
  )
}

export interface AlertDescriptionProps extends ComponentProps<'div'> {}

export function AlertDescription({ className, ...props }: AlertDescriptionProps) {
  return (
    <div
      {...props}
      data-slot="alert-description"
      className={cn(
        'text-pretty leading-relaxed text-muted-foreground [&_a]:underline [&_a]:underline-offset-4',
        className,
      )}
    />
  )
}

export interface AlertActionProps extends ComponentProps<'div'> {}

export function AlertAction({ className, ...props }: AlertActionProps) {
  return (
    <div
      {...props}
      data-slot="alert-action"
      className={cn('flex flex-wrap items-center gap-2 pt-1', className)}
    />
  )
}

export interface AlertCloseProps extends Omit<HTMLMotionProps<'button'>, 'layout'> {}

export function AlertClose({ className, children, onClick, ...props }: AlertCloseProps) {
  const { dismiss, reduce } = useAlertContext('AlertClose')
  return (
    <motion.button
      type="button"
      aria-label="关闭通知"
      {...props}
      tabIndex={props.tabIndex ?? 0}
      data-slot="alert-close"
      layout={reduce ? false : 'position'}
      transition={SPRING_PRESS}
      whileTap={reduce ? undefined : { scale: 0.94 }}
      className={cn(
        '-m-1 inline-flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
        className,
      )}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) dismiss()
      }}
    >
      {children ?? <X aria-hidden="true" className="size-3.5" />}
    </motion.button>
  )
}
