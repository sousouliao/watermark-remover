import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'

export const Route = createRootRoute({ component: RootLayout })

function RootLayout() {
  const authenticated = useAuthStore(state => state.authenticated)
  const user = useAuthStore(state => state.user)
  const logout = useAuthStore(state => state.logout)

  return (
    <div className="relative min-h-svh overflow-hidden bg-background font-sans text-foreground">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] h-[50%] w-[50%] animate-pulse-subtle rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute right-[-10%] bottom-[-20%] h-[50%] w-[50%] animate-pulse-subtle rounded-full bg-secondary/30 blur-[120px]" style={{ animationDelay: '1s' }} />
      </div>
      <div className="relative z-10">
        {authenticated && (
          <div className="flex items-center justify-end gap-3 px-6 pt-4 text-sm text-muted-foreground">
            <span>{user?.login}</span>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>退出登录</Button>
          </div>
        )}
        <Outlet />
      </div>
    </div>
  )
}
