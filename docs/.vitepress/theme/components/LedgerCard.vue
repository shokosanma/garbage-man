<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

const { frontmatter } = useData()
const fm = frontmatter.value as Record<string, any>

const VERDICT_CLASS: Record<string, string> = {
  值: 'good',
  勉强: 'meh',
  不值: 'bad',
}

const verdictClass = computed(() => VERDICT_CLASS[fm.verdict] ?? 'none')

const specEntries = computed<[string, string][]>(() =>
  Object.entries((fm.specs ?? {}) as Record<string, string>),
)

// YAML 会把 `2026-03-15` 隐式解析成 Date 对象，直接插值会渲染成
// "Sun Mar 15 2026 00:00:00 GMT+0000"。frontmatter 里加引号能避开，
// 这里再兜一层，作者忘了加引号也不会渲染出乱码。
function asText(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return value == null ? '' : String(value)
}
</script>

<template>
  <div class="ledger-card">
    <div class="ledger-card__tag">
      <span class="ledger-card__verdict" :class="`is-${verdictClass}`">
        {{ fm.verdict ?? '未评' }}
      </span>
      <span v-if="fm.price" class="ledger-card__price">¥{{ fm.price }}</span>
    </div>

    <dl class="ledger-card__facts">
      <div v-if="fm.acquired">
        <dt>入手</dt>
        <dd>{{ asText(fm.acquired) }}</dd>
      </div>
      <div v-if="fm.condition">
        <dt>成色</dt>
        <dd>{{ fm.condition }}</dd>
      </div>
      <div v-if="fm.source">
        <dt>渠道</dt>
        <dd>{{ fm.source }}</dd>
      </div>
    </dl>

    <table v-if="specEntries.length" class="ledger-card__specs">
      <tbody>
        <tr v-for="[label, value] in specEntries" :key="label">
          <th scope="row">{{ label }}</th>
          <td>{{ value }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
