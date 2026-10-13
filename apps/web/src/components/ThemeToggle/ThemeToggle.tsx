import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [mode, setMode] = useState(() => localStorage.getItem('theme') || 'system')
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
    <Button
      variant="ghost"
      size="icon"
      className="size-9 rounded-full"
      aria-label={isDark ? '切换浅色模式' : '切换深色模式'}
      onClick={toggleTheme}
    >
      {isDark ? <Moon className="size-5" /> : <Sun className="size-5" />}
    </Button>
  )
}
