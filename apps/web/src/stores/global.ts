import { defineStore } from 'pinia'
import { useIsMobile } from '@/hooks/useIsMobile'

/**
 * 全局应用状态 store
 * 提供设备检测等全局共享状态
 */
export const useGlobalStore = defineStore('global', () => {
  const { isMobile } = useIsMobile()

  return {
    isMobile,
  }
})
