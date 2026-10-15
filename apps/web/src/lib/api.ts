import { sessionStore, setSessionToken } from './session'

const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export function apiUrl(path: string): string {
  return `${base}${path}`
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers)
  const token = sessionStore.getState().token
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(apiUrl(path), { ...options, headers })
  if (response.status === 401) setSessionToken('')
  return response
}

export async function apiData<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await apiFetch(path, options)
  }
  catch {
    throw new Error('无法连接后端服务，请检查网络及 API 地址')
  }

  const text = await response.text()
  let result: { data?: T, message?: string, success?: boolean } | null = null
  if (text) {
    try {
      result = JSON.parse(text)
    }
    catch {
      // 非 JSON 响应（例如网关错误或空 HTML）
    }
  }

  if (!response.ok || !result || !result.success) {
    throw new Error(
      result?.message || (response.status === 401 ? '登录会话无效或已过期，请重新登录' : '') || `后端服务未响应 (${response.status})，请检查后端服务状态`,
    )
  }
  return result.data as T
}
