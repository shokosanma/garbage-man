import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildSidebar } from '../docs/.vitepress/sidebar.ts'

function fixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-sidebar-'))
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content, 'utf8')
  }
  return root
}

function md(fields: Record<string, string | number>, body = '内容'): string {
  const head = Object.entries(fields).map(([k, v]) => `${k}: ${v}`)
  return ['---', ...head, '---', '', body, ''].join('\n')
}

test('内容目录不存在时抛出明确错误', () => {
  assert.throws(() => buildSidebar('/definitely/not/here'), /内容目录不存在/)
})

test('空目录返回空数组', () => {
  assert.deepEqual(buildSidebar(fixture({})), [])
})

test('顶层 index.md 不出现在侧边栏', () => {
  const root = fixture({ 'index.md': md({ title: '首页' }) })
  assert.deepEqual(buildSidebar(root), [])
})

test('含 index.md 的目录成为分组，标题取自 frontmatter', () => {
  const root = fixture({ 'cloud/index.md': md({ title: '云账单篇' }) })
  const sidebar = buildSidebar(root)
  assert.equal(sidebar.length, 1)
  assert.equal(sidebar[0].text, '云账单篇')
  assert.equal(sidebar[0].link, '/cloud/')
})

test('缺 index.md 的目录被跳过', () => {
  const root = fixture({
    'cloud/index.md': md({ title: '云账单篇' }),
    'cloud/orphan/notes.md': md({ title: '孤儿文件' }),
  })
  const sidebar = buildSidebar(root)
  assert.equal(sidebar.length, 1)
  assert.equal(sidebar[0].items?.length, 0)
})

test('sidebar_label 覆盖 title', () => {
  const root = fixture({
    'cloud/index.md': md({ title: '云账单篇', sidebar_label: '云账单' }),
  })
  assert.equal(buildSidebar(root)[0].text, '云账单')
})

test('叶子条目链接为相对路径且去掉 .md', () => {
  const root = fixture({
    'cloud/index.md': md({ title: '云账单篇' }),
    'cloud/overview.md': md({ title: '四步法总纲' }),
  })
  const item = buildSidebar(root)[0].items?.[0]
  assert.equal(item?.text, '四步法总纲')
  assert.equal(item?.link, '/cloud/overview')
})

test('嵌套目录生成二级分组', () => {
  const root = fixture({
    'cloud/index.md': md({ title: '云账单篇' }),
    'cloud/visibility/index.md': md({ title: '① 看见' }),
  })
  const group = buildSidebar(root)[0].items?.[0]
  assert.equal(group?.text, '① 看见')
  assert.equal(group?.link, '/cloud/visibility/')
  assert.ok(Array.isArray(group?.items))
})

test('order 决定排序，数字小的在前', () => {
  const root = fixture({
    'cloud/index.md': md({ title: '云账单篇' }),
    'cloud/second.md': md({ title: '第二', order: 2 }),
    'cloud/first.md': md({ title: '第一', order: 1 }),
  })
  const items = buildSidebar(root)[0].items ?? []
  assert.deepEqual(items.map((i) => i.text), ['第一', '第二'])
})

test('order 相同时文件排在目录前', () => {
  const root = fixture({
    'cloud/index.md': md({ title: '云账单篇' }),
    'cloud/a-file.md': md({ title: '文件' }),
    'cloud/z-dir/index.md': md({ title: '目录' }),
  })
  const items = buildSidebar(root)[0].items ?? []
  assert.deepEqual(items.map((i) => i.text), ['文件', '目录'])
})

test('order 与 kind 都相同时按标题排序', () => {
  const root = fixture({
    'cloud/index.md': md({ title: '云账单篇' }),
    'cloud/b.md': md({ title: '乙' }),
    'cloud/a.md': md({ title: '甲' }),
  })
  const items = buildSidebar(root)[0].items ?? []
  assert.deepEqual(items.map((i) => i.text), ['甲', '乙'])
})

test('缺少 title 时回退到文件名', () => {
  const root = fixture({
    'cloud/index.md': md({ title: '云账单篇' }),
    'cloud/no-title.md': '---\n---\n\n正文',
  })
  const item = buildSidebar(root)[0].items?.[0]
  assert.equal(item?.text, 'no-title')
})
