import { Moon, Sun } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { ActionSwapIcon } from '@/components/motion/action-swap'
import { SPRING_PRESS } from '@/lib/ease'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false,
  )
  const [mode, setMode] = useState(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem('theme') || 'system' : 'system',
  )
  const reduce = useReducedMotion()

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    function apply() {
      const dark = mode === 'dark' || (mode !== 'light' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
      setIsDark(dark)
    }
    apply()
    if (mode !== 'dark' && mode !== 'light') media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [mode])

  function toggleTheme() {
    const nextMode = isDark ? 'light' : 'dark'
    localStorage.setItem('theme', nextMode)
    setMode(nextMode)
  }

  return (
    <motion.button
      type="button"
      whileTap={reduce ? undefined : { scale: 0.92 }}
      whileHover={reduce ? undefined : { scale: 1.04 }}
      transition={SPRING_PRESS}
      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-xl border border-border bg-background text-foreground transition-colors hover:border-foreground/30 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground"
      aria-label={isDark ? '切换浅色模式' : '切换深色模式'}
      onClick={toggleTheme}
    >
      <ActionSwapIcon
        value={isDark ? 'dark' : 'light'}
        animation="blur"
        className="size-4"
      >
        {isDark
          ? (
              <Sun className="size-4 text-foreground" />
            )
          : (
              <Moon className="size-4 text-foreground" />
            )}
      </ActionSwapIcon>
    </motion.button>
  )
}
