import { ChevronDown, Eraser, LogOut } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import ThemeToggle from '@/components/ThemeToggle/ThemeToggle'
import { EASE_OUT, SPRING_PRESS } from '@/lib/ease'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'

export default function AppHeader() {
  const authenticated = useAuthStore(state => state.authenticated)
  const user = useAuthStore(state => state.user)
  const logout = useAuthStore(state => state.logout)

  return (
    <header
      className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/85 px-4 py-2 backdrop-blur-md md:px-8"
      style={{ paddingTop: 'calc(0.5rem + var(--safe-top))' }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        {/* Left: Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">
            <Eraser className="size-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-foreground md:text-base">
              Watermark Remover
            </h1>
          </div>
        </div>

        {/* Right: Theme Toggle on the left of User Profile */}
        <div className="flex items-center gap-2.5">
          <ThemeToggle />

          {authenticated && user && (
            <UserMenu user={user} onLogout={() => void logout()} />
          )}
        </div>
      </div>
    </header>
  )
}

function UserMenu({
  user,
  onLogout,
}: {
  user: { id: number, login: string }
  onLogout: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [avatarError, setAvatarError] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('pointerdown', handlePointerDown)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const avatarSrc = user.id > 0 && !avatarError
    ? `https://avatars.githubusercontent.com/u/${user.id}?s=64&v=4`
    : null

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger: Avatar + Username unified capsule */}
      <motion.button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        whileTap={reduce ? undefined : { scale: 0.96 }}
        transition={SPRING_PRESS}
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          'flex h-8 min-w-36 max-w-48 shrink-0 items-center justify-between gap-2 rounded-full border px-2.5 text-xs text-foreground transition-colors cursor-pointer select-none',
          isOpen
            ? 'border-foreground/40 bg-muted/70'
            : 'border-border bg-muted/40 hover:border-foreground/30 hover:bg-muted/70',
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-foreground text-background">
            {avatarSrc
              ? (
                  <img
                    src={avatarSrc}
                    alt={user.login}
                    className="size-full object-cover"
                    onError={() => setAvatarError(true)}
                  />
                )
              : (
                  <span className="text-[10px] font-semibold leading-none">
                    {user.login.slice(0, 1).toUpperCase()}
                  </span>
                )}
          </div>

          <span className="truncate font-mono text-xs">{user.login}</span>
        </div>

        <ChevronDown
          className={`size-3 shrink-0 text-muted-foreground transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </motion.button>

      {/* Dropdown Menu (Strict Zero Shadow, pure hairline border with Spring Reveal, strictly matching trigger width) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: EASE_OUT }}
            className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-border bg-background p-1 text-foreground"
          >
            <div className="flex flex-col px-2.5 py-1.5">
              <span className="font-mono text-xs font-medium text-foreground truncate">
                {user.login}
              </span>
              <span className="text-[10px] text-muted-foreground">
                ID:
                {' '}
                {user.id}
              </span>
            </div>

            <div className="h-px bg-border my-1" role="separator" />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false)
                onLogout()
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <LogOut className="size-3.5" />
              <span>退出登录</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
