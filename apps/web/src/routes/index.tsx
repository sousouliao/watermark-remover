import { createFileRoute } from '@tanstack/react-router'
import { LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import WatermarkApp from '@/pages/WatermarkApp'
import { useAuthStore } from '@/stores/auth'

export const Route = createFileRoute('/')({
  beforeLoad: () => useAuthStore.getState().initialize(),
  component: Home,
})

function Home() {
  const authenticated = useAuthStore(state => state.authenticated)
  const busy = useAuthStore(state => state.busy)
  const error = useAuthStore(state => state.error)
  const login = useAuthStore(state => state.login)

  if (authenticated) return <WatermarkApp />

  return (
    <main className="flex min-h-svh items-center justify-center px-6">
      <Card className="w-full max-w-sm rounded-2xl bg-card/80 p-2 text-center backdrop-blur">
        <CardHeader>
          <CardTitle>Watermark Remover</CardTitle>
          <CardDescription className="pt-2">使用 GitHub 登录以访问图片处理服务。</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
          <Button className="w-full gap-2" disabled={busy} onClick={() => void login()}>
            <LogIn className="size-4" aria-hidden="true" />
            {busy ? '正在连接…' : '使用 GitHub 登录'}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
