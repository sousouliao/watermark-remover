<script setup lang="ts">
import { onMounted } from 'vue'
import { Button } from './components/ui/button'
import WatermarkApp from './pages/WatermarkApp.vue'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
onMounted(() => auth.initialize())
</script>

<template>
  <div class="min-h-svh bg-background relative overflow-hidden font-sans text-foreground">
    <!-- Background gradients -->
    <div class="absolute inset-0 z-0 pointer-events-none">
      <div class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] animate-pulse-subtle" />
      <div class="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary/30 blur-[120px] animate-pulse-subtle" style="animation-delay: 1s;" />
    </div>

    <div class="relative z-10">
      <template v-if="auth.authenticated">
        <div class="flex items-center justify-end gap-3 px-6 pt-4 text-sm text-muted-foreground">
          <span>{{ auth.user?.login }}</span>
          <Button variant="ghost" size="sm" @click="auth.logout()">
            退出登录
          </Button>
        </div>
        <WatermarkApp />
      </template>
      <main v-else class="min-h-svh flex items-center justify-center px-6">
        <div class="w-full max-w-sm rounded-2xl border bg-card/80 p-8 text-center shadow-sm backdrop-blur">
          <h1 class="text-2xl font-semibold">
            Watermark Remover
          </h1>
          <p class="mt-3 text-sm text-muted-foreground">
            使用 GitHub 登录以访问图片处理服务。
          </p>
          <p v-if="auth.error" role="alert" class="mt-4 text-sm text-destructive">
            {{ auth.error }}
          </p>
          <Button class="mt-6 w-full" :disabled="auth.busy" @click="auth.login()">
            {{ auth.busy ? '正在连接…' : '使用 GitHub 登录' }}
          </Button>
        </div>
      </main>
    </div>
  </div>
</template>
