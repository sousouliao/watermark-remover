import { Eraser } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle/ThemeToggle'

export default function AppHeader() {
  return (
    <header
      className="flex items-center justify-between px-6 py-4 lg:px-8"
      style={{ paddingTop: 'calc(1rem + var(--safe-top))' }}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
          <Eraser className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight md:text-xl">Watermark Remover</h1>
          <p className="hidden text-xs text-foreground/70 sm:block">AI 智能水印移除</p>
        </div>
      </div>
      <ThemeToggle />
    </header>
  )
}
