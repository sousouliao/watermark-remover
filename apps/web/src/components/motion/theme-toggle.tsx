import { Moon, Sun } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { type ComponentPropsWithoutRef, useEffect, useState } from 'react'
import { ActionSwapIcon } from '@/components/motion/action-swap'
import { EASE_OUT_CSS } from '@/lib/ease'
import { cn } from '@/lib/utils'

export type ThemeVariant = 'rectangle' | 'circle' | 'circle-blur' | 'blinds'

export type RectStart =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'bottom-up'

export interface ThemeToggleProps
  extends Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'onClick'> {
  /** Animation variant. Default: "circle-blur". */
  variant?: ThemeVariant
  /** Origin direction for the reveal. Default: "top-right". */
  start?: RectStart
  iconClassName?: string
}

const VT_STYLE_ID = 'beui-theme-toggle-vt'

const VT_CSS = `
html[data-beui-vt="rect"]::view-transition-old(root) {
  animation: none;
  mix-blend-mode: normal;
}
html[data-beui-vt="rect"]::view-transition-new(root) {
  mix-blend-mode: normal;
  animation: beui-rect-reveal 400ms ease-out;
}
html[data-beui-vt="circle"]::view-transition-old(root),
html[data-beui-vt="circle-blur"]::view-transition-old(root) {
  animation: none;
  mix-blend-mode: normal;
}
html[data-beui-vt="circle"]::view-transition-new(root) {
  mix-blend-mode: normal;
  animation: beui-circle-reveal 700ms cubic-bezier(0.4, 0, 0.2, 1);
}
html[data-beui-vt="circle-blur"]::view-transition-new(root) {
  mix-blend-mode: normal;
  animation: beui-circle-blur-reveal 700ms cubic-bezier(0.4, 0, 0.2, 1);
}
html[data-beui-vt="blinds"]::view-transition-old(root) {
  animation: none;
  mix-blend-mode: normal;
}
@property --beui-vt-slat {
  syntax: "<length>";
  inherits: false;
  initial-value: 72px;
}
html[data-beui-vt="blinds"]::view-transition-new(root) {
  mix-blend-mode: normal;
  mask-image: linear-gradient(
    90deg,
    #000 0 var(--beui-vt-slat),
    transparent calc(var(--beui-vt-slat) + 20px)
  );
  mask-size: 72px 100%;
  mask-repeat: repeat;
  animation: beui-blinds-reveal 700ms ${EASE_OUT_CSS};
}
@keyframes beui-rect-reveal {
  from { clip-path: var(--beui-vt-from, inset(100% 0 0 0)); }
  to   { clip-path: inset(0 0 0 0); }
}
@keyframes beui-circle-reveal {
  from { clip-path: circle(0% at var(--beui-vt-origin, 50% 100%)); }
  to   { clip-path: circle(150% at var(--beui-vt-origin, 50% 100%)); }
}
@keyframes beui-circle-blur-reveal {
  from { clip-path: circle(0% at var(--beui-vt-origin, 50% 100%)); filter: blur(8px); }
  to   { clip-path: circle(150% at var(--beui-vt-origin, 50% 100%)); filter: blur(0px); }
}
@keyframes beui-blinds-reveal {
  from { --beui-vt-slat: -20px; }
  to   { --beui-vt-slat: 72px; }
}
`

const RECT_FROM: Record<RectStart, string> = {
  'top-left': 'inset(0 100% 100% 0)',
  'top-right': 'inset(0 0 100% 100%)',
  'bottom-left': 'inset(100% 100% 0 0)',
  'bottom-right': 'inset(100% 0 0 100%)',
  'center': 'inset(50% 50% 50% 50%)',
  'bottom-up': 'inset(100% 0 0 0)',
}

const CIRCLE_ORIGIN: Record<RectStart, string> = {
  'top-left': '0% 0%',
  'top-right': '100% 0%',
  'bottom-left': '0% 100%',
  'bottom-right': '100% 100%',
  'center': '50% 50%',
  'bottom-up': '50% 100%',
}

export function useThemeToggle({
  variant = 'circle-blur',
  start = 'top-right',
}: { variant?: ThemeVariant, start?: RectStart } = {}) {
  const reduce = useReducedMotion() ?? false
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false,
  )

  useEffect(() => {
    setMounted(true)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const initialMode = localStorage.getItem('theme') || 'system'
    const dark = initialMode === 'dark' || (initialMode !== 'light' && media.matches)
    document.documentElement.classList.toggle('dark', dark)
    setIsDark(dark)
  }, [])

  useEffect(() => {
    if (document.getElementById(VT_STYLE_ID)) return
    const el = document.createElement('style')
    el.id = VT_STYLE_ID
    el.textContent = VT_CSS
    document.head.appendChild(el)
  }, [])

  const toggle = () => {
    const nextDark = !isDark
    const nextMode = nextDark ? 'dark' : 'light'

    const applyTheme = () => {
      document.documentElement.classList.toggle('dark', nextDark)
      localStorage.setItem('theme', nextMode)
      setIsDark(nextDark)
    }

    if (reduce || !('startViewTransition' in document)) {
      applyTheme()
      return
    }

    const root = document.documentElement

    if (variant === 'rectangle') {
      root.style.setProperty('--beui-vt-from', RECT_FROM[start])
      root.dataset.beuiVt = 'rect'
    }
    else if (variant === 'blinds') {
      root.dataset.beuiVt = 'blinds'
    }
    else {
      root.style.setProperty('--beui-vt-origin', CIRCLE_ORIGIN[start])
      root.dataset.beuiVt = variant
    }

    const vt = (
      document as Document & {
        startViewTransition: (cb: () => void) => { finished: Promise<void> }
      }
    ).startViewTransition(applyTheme)

    vt.finished.finally(() => {
      delete root.dataset.beuiVt
    })
  }

  return { isDark, mounted, toggle }
}

export function ThemeToggle({
  variant = 'circle-blur',
  start = 'top-right',
  className,
  iconClassName = 'size-4',
  ...rest
}: ThemeToggleProps) {
  const { isDark, mounted, toggle } = useThemeToggle({ variant, start })

  return (
    <button
      type="button"
      aria-label={mounted && isDark ? '切换浅色模式' : '切换深色模式'}
      onClick={toggle}
      className={cn(
        'inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-foreground/30 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground',
        className,
      )}
      {...rest}
    >
      {mounted
        ? (
            <ActionSwapIcon
              value={isDark ? 'dark' : 'light'}
              animation="blur"
              className={iconClassName}
            >
              {isDark
                ? (
                    <Sun className={cn(iconClassName, 'text-foreground')} />
                  )
                : (
                    <Moon className={cn(iconClassName, 'text-foreground')} />
                  )}
            </ActionSwapIcon>
          )
        : (
            <span className={iconClassName} aria-hidden="true" />
          )}
    </button>
  )
}
