import { useSyncExternalStore } from 'react'

export const MOBILE_QUERY = '(max-width: 768px)'
const media = window.matchMedia(MOBILE_QUERY)

function subscribe(onChange: () => void) {
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export function useIsMobile() {
  const isMobile = useSyncExternalStore(subscribe, () => media.matches, () => false)
  return { isMobile }
}
