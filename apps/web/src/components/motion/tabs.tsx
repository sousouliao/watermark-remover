import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  cancelFrame,
  frame,
  motion,
  MotionConfig,
  type Transition,
  useReducedMotion,
} from 'motion/react'
import {
  type ButtonHTMLAttributes,
  createContext,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { EASE_OUT } from '@/lib/ease'
import { cn } from '@/lib/utils'

type Variant = 'pill' | 'underline' | 'segment'

interface Ctx {
  value: string
  setValue: (v: string) => void
  layoutId: string
  variant: Variant
}

const TabsCtx = createContext<Ctx | null>(null)

export function useTabs() {
  const ctx = useContext(TabsCtx)
  if (!ctx) throw new Error('Tabs.* must be used inside <Tabs>')
  return ctx
}

const transition: Transition = {
  type: 'spring',
  stiffness: 280,
  damping: 32,
  mass: 1.0,
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  variant = 'pill',
  children,
  className,
}: {
  defaultValue?: string
  value?: string
  onValueChange?: (v: string) => void
  variant?: Variant
  children: ReactNode
  className?: string
}) {
  const [internal, setInternal] = useState(defaultValue ?? '')
  const layoutId = useId()
  const reduce = useReducedMotion()
  const controlled = value !== undefined
  const current = controlled ? value : internal
  const setValue = useCallback(
    (v: string) => {
      if (!controlled) setInternal(v)
      onValueChange?.(v)
    },
    [controlled, onValueChange],
  )
  const contextValue = useMemo(
    () => ({ value: current, setValue, layoutId, variant }),
    [current, layoutId, setValue, variant],
  )
  return (
    <MotionConfig transition={reduce ? { duration: 0 } : transition}>
      <TabsCtx.Provider value={contextValue}>
        <motion.div layoutRoot className={className}>
          {children}
        </motion.div>
      </TabsCtx.Provider>
    </MotionConfig>
  )
}

const listClasses: Record<Variant, string> = {
  pill: 'inline-flex items-center gap-0.5 rounded-full bg-secondary/80 p-0.5 border border-border/60',
  underline: 'inline-flex items-center gap-1 border-b border-border',
  segment: 'inline-flex items-center gap-0.5 rounded-xl bg-secondary/80 p-0.5 border border-border/60',
}

export function TabsList({
  children,
  className,
  wrapperClassName,
  ...props
}: {
  wrapperClassName?: string
} & HTMLAttributes<HTMLDivElement>) {
  const { variant, value } = useTabs()
  const reduce = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const viewportId = useId()
  const [edges, setEdges] = useState({ overflow: false, left: false, right: false })

  const measure = useCallback(() => {
    const root = rootRef.current
    const viewport = viewportRef.current
    if (!root || !viewport) return
    const overflow = viewport.scrollWidth > root.clientWidth + 1
    const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    const rtl = getComputedStyle(viewport).direction === 'rtl'
    const fromLeft = Math.max(0, Math.min(max, rtl ? max + viewport.scrollLeft : viewport.scrollLeft))
    const next = { overflow, left: fromLeft > 1, right: fromLeft < max - 1 }
    setEdges(prev =>
      prev.overflow === next.overflow && prev.left === next.left && prev.right === next.right
        ? prev
        : next,
    )
  }, [])

  const reveal = useCallback(
    (tab: HTMLElement | null) => {
      const viewport = viewportRef.current
      if (!viewport || !tab) return
      const frameRect = viewport.getBoundingClientRect()
      const itemRect = tab.getBoundingClientRect()
      const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
      const rtl = getComputedStyle(viewport).direction === 'rtl'
      const fromLeft = Math.max(0, Math.min(max, rtl ? max + viewport.scrollLeft : viewport.scrollLeft))
      const left = frameRect.left + (fromLeft > 1 ? 36 : 0)
      const right = frameRect.right - (fromLeft < max - 1 ? 36 : 0)
      const delta = itemRect.left < left ? itemRect.left - left : itemRect.right > right ? itemRect.right - right : 0
      if (delta) viewport.scrollBy({ left: delta, behavior: reduce ? 'instant' : 'smooth' })
    },
    [reduce],
  )

  useLayoutEffect(() => {
    const root = rootRef.current
    const viewport = viewportRef.current
    const list = listRef.current
    if (!root || !viewport || !list) return
    const update = () => {
      measure()
      reveal(list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]'))
    }
    const observer = new ResizeObserver(update)
    observer.observe(root)
    observer.observe(viewport)
    observer.observe(list)
    viewport.addEventListener('scroll', measure, { passive: true })
    update()
    return () => {
      observer.disconnect()
      viewport.removeEventListener('scroll', measure)
    }
  }, [measure, reveal])

  useLayoutEffect(() => {
    void children
    void value
    void edges.overflow
    measure()
    reveal(listRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? null)
  }, [children, value, edges.overflow, measure, reveal])

  useLayoutEffect(() => {
    if (variant === 'underline') return
    const list = listRef.current
    if (!list) return
    void children
    const labels = Array.from(list.querySelectorAll<HTMLElement>('[data-tabs-label]'))
    const indicator = list.querySelector<HTMLElement>('[data-tabs-indicator]')
    const target = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
    if (!indicator || !target || target.dataset.tabsValue !== value) {
      for (const label of labels) label.style.clipPath = 'inset(0 100% 0 0)'
      return
    }
    let frames = 0
    let stillFrames = 0
    let previous: { left: number, right: number } | undefined
    const syncClips = () => {
      const pill = (reduce ? target : indicator).getBoundingClientRect()
      const clips = labels.map((label) => {
        const bounds = label.getBoundingClientRect()
        const left = Math.max(0, Math.min(bounds.width, pill.left - bounds.left))
        const right = Math.max(0, Math.min(bounds.width, bounds.right - pill.right))
        return left + right >= bounds.width ? 'inset(0 100% 0 0)' : `inset(0 ${right}px 0 ${left}px)`
      })
      labels.forEach((label, index) => {
        if (label.style.clipPath !== clips[index]) label.style.clipPath = clips[index]
      })
      frames += 1
      stillFrames
        = previous && Math.abs(pill.left - previous.left) < 0.01 && Math.abs(pill.right - previous.right) < 0.01
          ? stillFrames + 1
          : 0
      previous = { left: pill.left, right: pill.right }
      if (reduce || (frames > 2 && stillFrames >= 2)) cancelFrame(syncClips)
    }
    frame.postRender(syncClips, true)
    return () => cancelFrame(syncClips)
  }, [value, children, variant, reduce])

  const scroll = (direction: number) => {
    const viewport = viewportRef.current
    if (viewport) viewport.scrollBy({ left: direction * viewport.clientWidth * 0.8, behavior: reduce ? 'instant' : 'smooth' })
  }
  const controlClass
    = 'absolute inset-y-0 z-20 inline-flex w-8 items-center justify-center text-foreground transition-opacity hover:opacity-70 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-0'
  const surfaceClass = 'rounded-md bg-secondary'

  return (
    <div
      ref={rootRef}
      className={cn('relative isolate flex w-full max-w-full min-w-0 items-center', edges.overflow && surfaceClass, wrapperClassName)}
    >
      {edges.overflow && (
        <button
          type="button"
          aria-label="Scroll left"
          aria-controls={viewportId}
          disabled={!edges.left}
          onClick={() => scroll(-1)}
          className={cn(controlClass, 'left-0 rounded-l-full')}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
      )}
      <motion.div
        ref={viewportRef}
        id={viewportId}
        layoutScroll
        className={cn('w-full min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', edges.overflow && '[border-radius:inherit]')}
      >
        <div {...props} ref={listRef} role="tablist" className={cn(listClasses[variant], 'w-max', className)}>
          {children}
        </div>
      </motion.div>
      {edges.overflow && (
        <button
          type="button"
          aria-label="Scroll right"
          aria-controls={viewportId}
          disabled={!edges.right}
          onClick={() => scroll(1)}
          className={cn(controlClass, 'right-0 rounded-r-full')}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export function TabsTrigger({
  value,
  children,
  className,
  indicatorClassName,
  onClick,
  ...props
}: {
  value: string
  indicatorClassName?: string
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value'>) {
  const { value: current, setValue, layoutId, variant } = useTabs()
  const active = current === value
  const [initialClip] = useState(() => (active ? 'inset(0)' : 'inset(0 100% 0 0)'))

  if (variant === 'underline') {
    return (
      <button
        {...props}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={(event) => {
          onClick?.(event)
          if (!event.defaultPrevented) setValue(value)
        }}
        className={cn(
          'relative isolate px-3 pb-2 pt-1 -mb-px text-xs md:text-sm font-medium transition-colors inline-flex items-center whitespace-nowrap shrink-0',
          active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          className,
        )}
      >
        {children}
        {active
          ? (
              <motion.span
                layoutId={layoutId}
                layout
                className={cn('absolute bottom-0 left-0 right-0 h-0.5 bg-foreground', indicatorClassName)}
              />
            )
          : null}
      </button>
    )
  }

  const radius = variant === 'pill' ? 'rounded-full' : 'rounded-lg'

  return (
    <div className="relative shrink-0">
      {active
        ? (
            <motion.span
              data-tabs-indicator=""
              layoutId={layoutId}
              layout
              className={cn(
                'absolute inset-0 bg-foreground',
                radius,
                indicatorClassName,
              )}
            />
          )
        : null}
      <button
        {...props}
        type="button"
        role="tab"
        aria-selected={active}
        data-tabs-value={value}
        onClick={(event) => {
          onClick?.(event)
          if (!event.defaultPrevented) setValue(value)
        }}
        className={cn(
          'relative z-10 inline-flex items-center justify-center whitespace-nowrap bg-transparent px-3.5 py-1.5 text-xs md:text-sm font-medium outline-none transition-colors',
          'text-muted-foreground hover:text-foreground',
          radius,
          className,
        )}
      >
        {children}
        <span
          data-tabs-label=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 inline-flex items-center justify-center text-background font-medium [gap:inherit] [padding:inherit]"
          style={{ clipPath: initialClip }}
        >
          {children}
        </span>
      </button>
    </div>
  )
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string
  children: ReactNode
  className?: string
}) {
  const { value: current } = useTabs()
  const reduce = useReducedMotion()
  const active = current === value
  if (!active) {
    return (
      <div hidden className={className}>
        {children}
      </div>
    )
  }
  return (
    <motion.div
      key={value}
      initial={{ opacity: 0, y: reduce ? 0 : 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: EASE_OUT }}
      className={cn('mt-3', className)}
    >
      {children}
    </motion.div>
  )
}
