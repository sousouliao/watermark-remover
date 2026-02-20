<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const STEPS = [
  'Analyzing image...',
  'Detecting watermark region...',
  'Running AI inpainting model...',
  'Reconstructing pixels...',
  'Finalizing result...',
]

const currentStep = ref(0)
let stepInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  stepInterval = setInterval(() => {
    if (currentStep.value < STEPS.length - 1) {
      currentStep.value++
    }
  }, 3000)
})

onUnmounted(() => {
  if (stepInterval) clearInterval(stepInterval)
})
</script>

<template>
  <div class="animate-fade-in glass-card flex w-72 flex-col items-center gap-6 rounded-2xl p-8 md:w-80 md:p-12">
    <!-- Animated spinner -->
    <div class="relative h-16 w-16">
      <svg class="h-16 w-16 animate-spin" viewBox="0 0 64 64" fill="none">
        <circle
          cx="32"
          cy="32"
          r="28"
          stroke="hsl(var(--muted))"
          stroke-width="4"
        />
        <path
          d="M32 4a28 28 0 0 1 28 28"
          stroke="hsl(var(--primary))"
          stroke-width="4"
          stroke-linecap="round"
        />
      </svg>
    </div>

    <!-- Indeterminate progress bar -->
    <div class="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div class="animate-indeterminate h-full w-2/5 rounded-full bg-primary" />
    </div>

    <!-- Step indicator -->
    <div class="flex flex-col items-center gap-2">
      <p class="min-h-5 text-center text-sm font-medium text-foreground">
        {{ STEPS[currentStep] }}
      </p>
      <div class="flex gap-1">
        <div
          v-for="(_, i) in STEPS"
          :key="i"
          class="h-1 rounded-full transition-all duration-300"
          :class="[
            i <= currentStep ? 'bg-primary' : 'bg-muted-foreground/30',
            i === currentStep ? 'w-3' : 'w-1',
          ]"
        />
      </div>
    </div>
  </div>
</template>
