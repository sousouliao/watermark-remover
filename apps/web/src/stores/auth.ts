import { create } from 'zustand'
import { apiData, apiFetch } from '@/lib/api'
import { sessionStore, setSessionToken } from '@/lib/session'

interface User { id: number, login: string }
interface LoginResult { expiresAt: string, token: string, user: User }
interface AuthState {
  user: User | null
  authenticated: boolean
  busy: boolean
  error: string | null
  initialize: () => Promise<void>
  handleCallback: (search: string) => Promise<void>
  login: () => Promise<void>
  devLogin: () => void
  logout: () => Promise<void>
}

const verifierKey = 'watermark-login-verifier'
const stateKey = 'watermark-login-state'
let initialization: Promise<void> | undefined

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function errorMessage(cause: unknown): string {
  if (cause instanceof Error) {
    if (cause.name === 'SyntaxError') {
      return '后端未返回有效数据，请确认后端服务（127.0.0.1:3000）已启动'
    }
    if (cause.name === 'TypeError') {
      return '无法连接后端服务，请确认本地后端服务已启动'
    }
    return cause.message
  }
  return '无法连接后端，请稍后重试'
}

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  authenticated: false,
  busy: true,
  error: null,
  initialize: () => {
    initialization ??= (async () => {
      try {
        if (sessionStore.getState().token) {
          const user = await apiData<User>('/api/auth/me')
          set({ user, authenticated: !!sessionStore.getState().token })
        }
      }
      catch (cause) {
        setSessionToken('')
        set({ user: null, authenticated: false, error: errorMessage(cause) })
      }
      finally { set({ busy: false }) }
    })()
    return initialization
  },
  handleCallback: async (search) => {
    set({ busy: true, error: null })
    try {
      const params = new URLSearchParams(search)
      const code = params.get('code')
      const state = params.get('state')
      const verifier = sessionStorage.getItem(verifierKey)
      if (!code || !state || state !== sessionStorage.getItem(stateKey) || !verifier) {
        throw new Error('登录请求已失效，请重新登录')
      }
      sessionStorage.setItem(verifierKey, '')
      sessionStorage.setItem(stateKey, '')
      const result = await apiData<LoginResult>('/api/auth/github/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state, codeVerifier: verifier }),
      })
      setSessionToken(result.token)
      set({ user: result.user, authenticated: !!result.token })
    }
    catch (cause) {
      setSessionToken('')
      set({ user: null, authenticated: false, error: errorMessage(cause) })
    }
    finally {
      initialization = Promise.resolve()
      set({ busy: false })
    }
  },
  login: async () => {
    set({ busy: true, error: null })
    try {
      const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
      sessionStorage.setItem(verifierKey, verifier)
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
      const result = await apiData<{ authorizationUrl: string, state: string }>('/api/auth/github/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeChallenge: base64url(new Uint8Array(digest)) }),
      })
      sessionStorage.setItem(stateKey, result.state)
      location.assign(result.authorizationUrl)
    }
    catch (cause) {
      set({ error: errorMessage(cause), busy: false })
    }
  },
  devLogin: () => {
    setSessionToken('mock-dev-token')
    set({
      user: { id: 37927306, login: 'local-developer' },
      authenticated: true,
      error: null,
      busy: false,
    })
  },
  logout: async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    }
    catch {
      set({ error: '已退出本地登录；暂时无法连接服务器以撤销会话' })
    }
    finally {
      setSessionToken('')
      set({ user: null, authenticated: false })
    }
  },
}))

sessionStore.subscribe(({ token }) => {
  if (!token) useAuthStore.setState({ user: null, authenticated: false })
})
