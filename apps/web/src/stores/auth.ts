import { useSessionStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiData, apiFetch } from '@/lib/api'
import { sessionToken } from '@/lib/session'

interface User { id: number, login: string }
interface LoginResult { token: string, user: User, expiresAt: string }

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const busy = ref(true)
  const error = ref<string | null>(null)
  const verifier = useSessionStorage('watermark-login-verifier', '')
  const expectedState = useSessionStorage('watermark-login-state', '')
  const authenticated = computed(() => !!sessionToken.value && !!user.value)

  async function initialize() {
    try {
      if (location.pathname === '/auth/callback') {
        const params = new URLSearchParams(location.search)
        const code = params.get('code')
        const state = params.get('state')
        history.replaceState(null, '', '/')
        if (!code || !state || state !== expectedState.value || !verifier.value) {
          throw new Error('登录请求已失效，请重新登录')
        }
        const input = { code, state, codeVerifier: verifier.value }
        verifier.value = ''
        expectedState.value = ''
        const result = await apiData<LoginResult>('/api/auth/github/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        sessionToken.value = result.token
        user.value = result.user
      }
      else if (sessionToken.value) {
        user.value = await apiData<User>('/api/auth/me')
      }
    }
    catch (cause) {
      sessionToken.value = ''
      user.value = null
      error.value = cause instanceof Error && cause.name !== 'TypeError' ? cause.message : '无法连接后端，请稍后重试'
    }
    finally { busy.value = false }
  }

  async function login() {
    busy.value = true
    error.value = null
    try {
      verifier.value = base64url(crypto.getRandomValues(new Uint8Array(32)))
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier.value))
      const result = await apiData<{ authorizationUrl: string, state: string }>('/api/auth/github/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeChallenge: base64url(new Uint8Array(digest)) }),
      })
      expectedState.value = result.state
      location.assign(result.authorizationUrl)
    }
    catch (cause) {
      error.value = cause instanceof Error && cause.name !== 'TypeError' ? cause.message : '无法连接后端，请稍后重试'
      busy.value = false
    }
  }

  async function logout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    }
    catch {
      error.value = '已退出本地登录；暂时无法连接服务器以撤销会话'
    }
    finally {
      sessionToken.value = ''
      user.value = null
    }
  }

  return { user, busy, error, authenticated, initialize, login, logout }
})
