<script setup lang="ts">
import WatermarkRemover from './components/WatermarkRemover.vue'
</script>

<template>
  <main class="min-h-screen flex flex-col items-center p-8 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.15)_0%,transparent_40%),radial-gradient(circle_at_80%_80%,rgba(168,85,247,0.15)_0%,transparent_40%)]">
    <header class="text-center mb-12 animate-fade-in-down">
      <h1 class="text-5xl font-extrabold gradient-text tracking-tight">
        Watermark Remover
      </h1>
      <p class="text-text-dim text-lg mt-2">
        Powered by SDXL Inpainting
      </p>
    </header>

    <WatermarkRemover />

    <footer class="mt-auto py-8 text-text-dim text-sm">
      <p>&copy; 2024 Watermark Remover BFF. All rights reserved.</p>
    </footer>
  </main>
</template>
