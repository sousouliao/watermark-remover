<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { Button } from '@/components/ui/button'

const isDark = ref(false)

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

onMounted(() => {
  const stored = localStorage.getItem('theme')
  if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
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
