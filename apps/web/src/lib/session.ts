import { useSessionStorage } from '@vueuse/core'

export const sessionToken = useSessionStorage('watermark-session', '')
