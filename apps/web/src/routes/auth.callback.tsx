import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth'

export const Route = createFileRoute('/auth/callback')({
  beforeLoad: async ({ location }) => {
    await useAuthStore.getState().handleCallback(location.searchStr)
    throw redirect({ to: '/', replace: true })
  },
  pendingComponent: () => <main className="flex min-h-svh items-center justify-center" role="status">正在完成登录…</main>,
})
