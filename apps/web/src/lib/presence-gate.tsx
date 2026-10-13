import type { ReactNode } from 'react'
import { useIsPresent } from 'motion/react'

export interface PresenceGateRenderProps {
  isPresent: boolean
  gate: {
    inert: boolean
    style: { pointerEvents: 'auto' | 'none' }
  }
}

export interface PresenceGateProps {
  children: (props: PresenceGateRenderProps) => ReactNode
}

export function PresenceGate({ children }: PresenceGateProps) {
  const isPresent = useIsPresent()

  return children({
    isPresent,
    gate: {
      inert: !isPresent,
      style: { pointerEvents: isPresent ? 'auto' : 'none' },
    },
  })
}
