import { useMediaQuery } from '@vueuse/core'

const MOBILE_BREAKPOINT = 768

/**
 * 判断当前设备是否为移动端
 * 基于 VueUse 的 useMediaQuery，使用 matchMedia API 响应式检测
 */
export function useIsMobile() {
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT}px)`)
  return { isMobile }
}
