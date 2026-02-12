<script setup lang="ts">
import { Droplets } from 'lucide-vue-next'
import ThemeToggle from './ThemeToggle.vue'
</script>

<template>
  <header class="flex items-center justify-between px-4 py-4 md:px-6 lg:px-8">
    <div class="flex items-center gap-3">
      <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
        <Droplets class="h-5 w-5 text-primary" />
      </div>
      <div>
        <h1 class="text-lg font-semibold tracking-tight text-foreground md:text-xl">
          <span class="bg-linear-to-r from-primary to-accent bg-clip-text text-transparent">
            Watermark Remover
          </span>
        </h1>
        <p class="hidden text-xs text-muted-foreground sm:block">
          AI-Powered Watermark Removal
        </p>
      </div>
    </div>
    <ThemeToggle />
  </header>
</template>
