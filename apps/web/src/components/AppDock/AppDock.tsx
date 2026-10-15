import { BookOpen, Eraser, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { EASE_OUT, SPRING_LAYOUT } from '@/lib/ease'
import { useAuthStore } from '@/stores/auth'
import './app-dock.css'

type AppTab = 'watermark' | 'xhs'
type ThemeMode = 'system' | 'light' | 'dark'

const themes = [
  { value: 'system', label: '跟随系统', Icon: Monitor },
  { value: 'light', label: '浅色模式', Icon: Sun },
  { value: 'dark', label: '深色模式', Icon: Moon },
] as const

// 账户区在参考宽度上追加：两个 16px 间距 + 4px 分隔 + 35px 头像，右内边距从 20px 收到 13px。
const ACCOUNT_WIDTH = 16 * 2 + 4 + 35 - 7

// The reference uses eight overlapping masked backdrop layers, not a blurred pill.
const blurLayers = Array.from({ length: 8 }, (_, index) => {
  const start = index * 12.5
  const stops = index < 6
    ? `transparent ${start}%, black ${start + 12.5}%, black ${start + 25}%, transparent ${start + 37.5}%`
    : index === 6
      ? 'transparent 75%, black 87.5%, black 100%'
      : 'transparent 87.5%, black 100%'
  return {
    backdropFilter: `blur(${0.1875 * 2 ** index}px)`,
    WebkitBackdropFilter: `blur(${0.1875 * 2 ** index}px)`,
    maskImage: `linear-gradient(to bottom, ${stops})`,
    WebkitMaskImage: `linear-gradient(to bottom, ${stops})`,
  }
})

export default function AppDock({ activeTab, onTabChange }: {
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const reduce = useReducedMotion()
  const user = useAuthStore(state => state.user)
  const logout = useAuthStore(state => state.logout)
  const accountWidth = user ? ACCOUNT_WIDTH : 0
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  })

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches))
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  function selectTheme(value: ThemeMode) {
    localStorage.setItem('theme', value)
    setTheme(value)
  }

  return (
    <>
      <div className="app-dock-blur" aria-hidden="true">
        {blurLayers.map((style, index) => <div key={index} style={style} />)}
      </div>
      <aside className="app-dock-position" aria-label="应用功能导航">
        <motion.div
          className="app-dock"
          data-expanded={expanded}
          data-account={!!user}
          initial={false}
          animate={{ width: (expanded ? 420 : 301) + accountWidth }}
          transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
        >
          <nav
            className="app-dock-apps"
            aria-label="工作台"
            onPointerEnter={event => event.pointerType === 'mouse' && setExpanded(true)}
            onPointerLeave={() => setExpanded(false)}
            onFocusCapture={() => setExpanded(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false)
            }}
          >
            <button
              type="button"
              className="app-dock-app"
              aria-label="图片去水印"
              aria-pressed={activeTab === 'watermark'}
              onClick={() => onTabChange('watermark')}
            >
              <Eraser className="app-dock-reveal-icon" aria-hidden="true" />
              <span>图片去水印</span>
            </button>
            <button
              type="button"
              className="app-dock-app"
              aria-label="小红书解析"
              aria-pressed={activeTab === 'xhs'}
              onClick={() => onTabChange('xhs')}
            >
              <BookOpen aria-hidden="true" />
              <span className="app-dock-reveal-label">小红书解析</span>
            </button>
          </nav>
          <span className="app-dock-separator" aria-hidden="true" />
          <div className="app-dock-themes" role="group" aria-label="外观主题">
            {themes.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                className="app-dock-theme"
                aria-label={label}
                aria-pressed={theme === value}
                title={label}
                onClick={() => selectTheme(value)}
              >
                <Icon aria-hidden="true" fill={theme === value && value === 'dark' ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
          {user && (
            <>
              <span className="app-dock-separator app-dock-account-separator" aria-hidden="true" />
              <DockAccount user={user} onLogout={() => void logout()} />
            </>
          )}
        </motion.div>
      </aside>
    </>
  )
}

function DockAccount({ user, onLogout }: {
  user: { id: number, login: string }
  onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const avatarSrc = user.id > 0 && !avatarError
    ? `https://avatars.githubusercontent.com/u/${user.id}?s=64&v=4`
    : null
  const hidden = { opacity: 0, y: reduce ? 0 : 6, scale: reduce ? 1 : 0.97, filter: reduce ? 'none' : 'blur(3px)' }

  return (
    <div ref={rootRef} className="app-dock-account">
      <button
        ref={triggerRef}
        type="button"
        className="app-dock-avatar"
        aria-label={`账户：${user.login}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        {avatarSrc
          ? <img src={avatarSrc} alt="" onError={() => setAvatarError(true)} />
          : <span aria-hidden="true">{user.login.slice(0, 1).toUpperCase()}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="账户"
            className="app-dock-menu"
            style={{ originX: 1, originY: 1 }}
            initial={hidden}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={hidden}
            transition={{ duration: 0.18, ease: EASE_OUT }}
          >
            <div className="app-dock-menu-user">
              <strong>{user.login}</strong>
              <span>已通过 GitHub 登录</span>
            </div>
            <button
              type="button"
              role="menuitem"
              className="app-dock-menu-item"
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
            >
              <LogOut aria-hidden="true" />
              退出登录
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
