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

// 未知 verdict 不产出修饰符 class，落到基础样式即可。
// 契约里只有 is-good / is-meh / is-bad 三个修饰符，不要多出一个没人管的 is-none。
const verdictClass = computed(() => VERDICT_CLASS[fm.verdict] ?? '')

const specEntries = computed<[string, string][]>(() =>
  Object.entries((fm.specs ?? {}) as Record<string, string>),
)

// frontmatter 里的日期必须加引号（date: "2026-03-15"），这是唯一可靠的防线：
// 不加引号时 YAML 会把日期解析成 Date 对象，而 VitePress 注入页面数据时做了
// JSON.parse(JSON.stringify(data))，Date 到客户端前已经变成 ISO 串，
// 直接插值会渲染成 "2026-03-15T00:00:00.000Z"。
// 下面两层是兜底：Date 对象本身，以及被序列化过的 ISO 串。
function asText(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10)
  return value == null ? '' : String(value)
}
</script>

<template>
  <div class="ledger-card">
    <div class="ledger-card__tag">
      <span class="ledger-card__verdict" :class="verdictClass ? `is-${verdictClass}` : undefined">
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
