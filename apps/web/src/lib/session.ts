import { createStore } from 'zustand/vanilla'

export const sessionStore = createStore<{ token: string }>(() => ({
  token: sessionStorage.getItem('watermark-session') ?? '',
}))

export function setSessionToken(token: string) {
  sessionStorage.setItem('watermark-session', token)
  sessionStore.setState({ token })
}
