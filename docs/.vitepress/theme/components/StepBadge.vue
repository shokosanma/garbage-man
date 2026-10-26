<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

const { frontmatter } = useData()
const fm = frontmatter.value as Record<string, any>

const STEPS: Record<string, string> = {
  visibility: '① 看见',
  identify: '② 识别',
  dispose: '③ 处置',
  prevent: '④ 防复发',
}

const label = computed(() => STEPS[fm.step] ?? '')
</script>

<template>
  <span v-if="label" class="step-badge">{{ label }}</span>
</template>
