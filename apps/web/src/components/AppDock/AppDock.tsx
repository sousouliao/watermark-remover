import { BookOpen, Eraser, Monitor, Moon, Sun } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { SPRING_LAYOUT } from '@/lib/ease'
import './app-dock.css'

type AppTab = 'watermark' | 'xhs'
type ThemeMode = 'system' | 'light' | 'dark'

const themes = [
  { value: 'system', label: '跟随系统', Icon: Monitor },
  { value: 'light', label: '浅色模式', Icon: Sun },
  { value: 'dark', label: '深色模式', Icon: Moon },
] as const

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
          initial={false}
          animate={{ width: expanded ? 420 : 301 }}
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
        </motion.div>
      </aside>
    </>
  )
}
