<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { onMounted, onUnmounted, ref } from 'vue'
import { Button } from '@/components/ui/button'

type ThemeMode = 'light' | 'dark' | 'system'

const isDark = ref(false)
const mode = ref<ThemeMode>('system')

function getSystemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(dark: boolean) {
  isDark.value = dark
  document.documentElement.classList.toggle('dark', dark)
}

function applyFromSystem() {
  applyTheme(getSystemDark())
}

function toggleTheme() {
  const nextDark = !isDark.value
  mode.value = nextDark ? 'dark' : 'light'
  localStorage.setItem('theme', mode.value)
  applyTheme(nextDark)
}

let mediaQuery: MediaQueryList | null = null

onMounted(() => {
  const stored = localStorage.getItem('theme') as ThemeMode | null
  if (stored === 'dark' || stored === 'light') {
    mode.value = stored
    applyTheme(stored === 'dark')
  }
  else {
    mode.value = 'system'
    applyFromSystem()
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', applyFromSystem)
  }
})

onUnmounted(() => {
  mediaQuery?.removeEventListener('change', applyFromSystem)
})
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    class="relative h-9 w-9 rounded-full hover:bg-secondary"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="toggleTheme"
  >
    <Sun
      class="h-5 w-5 transition-all duration-300 absolute"
      :class="[
        isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100',
      ]"
    />
    <Moon
      class="h-5 w-5 transition-all duration-300 absolute"
      :class="[
        isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0',
      ]"
    />
  </Button>
</template>
