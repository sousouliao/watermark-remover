<script setup lang="ts">
import WatermarkApp from './pages/WatermarkApp.vue'
</script>

<template>
  <div class="min-h-svh bg-background relative overflow-hidden font-sans text-foreground">
    <!-- Background gradients -->
    <div class="absolute inset-0 z-0 pointer-events-none">
      <div class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] animate-pulse-subtle" />
      <div class="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary/30 blur-[120px] animate-pulse-subtle" style="animation-delay: 1s;" />
    </div>

    <div class="relative z-10">
      <WatermarkApp />
    </div>
  </div>
</template>
