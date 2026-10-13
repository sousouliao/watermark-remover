import { sessionStore, setSessionToken } from './session'

const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export function apiUrl(path: string): string {
  return `${base}${path}`
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers)
  const token = sessionStore.getState().token
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(apiUrl(path), { ...options, headers })
  if (response.status === 401) setSessionToken('')
  return response
}

export async function apiData<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, options)
  const result = await response.json()
  if (!response.ok || !result.success) throw new Error(result.message || '服务暂时不可用，请稍后重试')
  return result.data as T
}
