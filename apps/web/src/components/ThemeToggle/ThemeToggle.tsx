import { ThemeToggle as MotionThemeToggle, type ThemeToggleProps } from '@/components/motion/theme-toggle'

export default function ThemeToggle(props: ThemeToggleProps) {
  return <MotionThemeToggle variant="circle-blur" start="top-right" {...props} />
}
