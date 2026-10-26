import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildSidebar } from '../docs/.vitepress/sidebar.ts'

interface TestScope {
  after(fn: () => void): void
}

function fixture(t: TestScope, files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-sidebar-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
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

test('空目录返回空数组', (t) => {
  assert.deepEqual(buildSidebar(fixture(t, {})), [])
})

test('顶层 index.md 不出现在侧边栏', (t) => {
  const root = fixture(t, { 'index.md': md({ title: '首页' }) })
  assert.deepEqual(buildSidebar(root), [])
})

test('含 index.md 的目录成为分组，标题取自 frontmatter', (t) => {
  const root = fixture(t, { 'cloud/index.md': md({ title: '云账单篇' }) })
  const sidebar = buildSidebar(root)
  assert.equal(sidebar.length, 1)
  assert.equal(sidebar[0].text, '云账单篇')
  assert.equal(sidebar[0].link, '/cloud/')
})

test('缺 index.md 的目录被跳过', (t) => {
  const root = fixture(t, {
    'cloud/index.md': md({ title: '云账单篇' }),
    'cloud/orphan/notes.md': md({ title: '孤儿文件' }),
  })
  const sidebar = buildSidebar(root)
  assert.equal(sidebar.length, 1)
  assert.equal(sidebar[0].items?.length, 0)
})

test('sidebar_label 覆盖 title', (t) => {
  const root = fixture(t, {
    'cloud/index.md': md({ title: '云账单篇', sidebar_label: '云账单' }),
  })
  assert.equal(buildSidebar(root)[0].text, '云账单')
})

test('叶子条目链接为相对路径且去掉 .md', (t) => {
  const root = fixture(t, {
    'cloud/index.md': md({ title: '云账单篇' }),
    'cloud/overview.md': md({ title: '四步法总纲' }),
  })
  const item = buildSidebar(root)[0].items?.[0]
  assert.equal(item?.text, '四步法总纲')
  assert.equal(item?.link, '/cloud/overview')
})

test('嵌套目录生成二级分组', (t) => {
  const root = fixture(t, {
    'cloud/index.md': md({ title: '云账单篇' }),
    'cloud/visibility/index.md': md({ title: '① 看见' }),
  })
  const group = buildSidebar(root)[0].items?.[0]
  assert.equal(group?.text, '① 看见')
  assert.equal(group?.link, '/cloud/visibility/')
  assert.ok(Array.isArray(group?.items))
})

test('order 决定排序，数字小的在前', (t) => {
  const root = fixture(t, {
    'cloud/index.md': md({ title: '云账单篇' }),
    'cloud/second.md': md({ title: '第二', order: 2 }),
    'cloud/first.md': md({ title: '第一', order: 1 }),
  })
  const items = buildSidebar(root)[0].items ?? []
  assert.deepEqual(items.map((i) => i.text), ['第一', '第二'])
})

test('order 相同时文件排在目录前', (t) => {
  const root = fixture(t, {
    'cloud/index.md': md({ title: '云账单篇' }),
    'cloud/a-file.md': md({ title: '文件' }),
    'cloud/z-dir/index.md': md({ title: '目录' }),
  })
  const items = buildSidebar(root)[0].items ?? []
  assert.deepEqual(items.map((i) => i.text), ['文件', '目录'])
})

test('order 与 kind 都相同时按标题排序', (t) => {
  const root = fixture(t, {
    'cloud/index.md': md({ title: '云账单篇' }),
    'cloud/b.md': md({ title: '乙' }),
    'cloud/a.md': md({ title: '甲' }),
  })
  const items = buildSidebar(root)[0].items ?? []
  assert.deepEqual(items.map((i) => i.text), ['甲', '乙'])
})

test('缺少 title 时回退到文件名', (t) => {
  const root = fixture(t, {
    'cloud/index.md': md({ title: '云账单篇' }),
    'cloud/no-title.md': '---\n---\n\n正文',
  })
  const item = buildSidebar(root)[0].items?.[0]
  assert.equal(item?.text, 'no-title')
})

test('叶子条目的 sidebar_label 同样覆盖 title', (t) => {
  const root = fixture(t, {
    'cloud/index.md': md({ title: '云账单篇' }),
    'cloud/overview.md': md({ title: '四步法总纲', sidebar_label: '总纲' }),
  })
  const item = buildSidebar(root)[0].items?.[0]
  assert.equal(item?.text, '总纲')
})

test('order 为非数字时回退到默认值 999', (t) => {
  const root = fixture(t, {
    'a-high.md': md({ title: '高位', order: 1000 }),
    'b-bad.md': md({ title: '坏值', order: 'abc' }),
  })
  assert.deepEqual(buildSidebar(root).map((i) => i.text), ['坏值', '高位'])
})

test('order 缺失时按默认值 999 排序', (t) => {
  const root = fixture(t, {
    'b-high.md': md({ title: '高位', order: 1000 }),
    'a-none.md': md({ title: '缺省' }),
  })
  assert.deepEqual(buildSidebar(root).map((i) => i.text), ['缺省', '高位'])
})

test('分组项的 collapsed 为 false', (t) => {
  const root = fixture(t, { 'cloud/index.md': md({ title: '云账单篇' }) })
  assert.equal(buildSidebar(root)[0].collapsed, false)
})

test('点开头的条目不会进入侧边栏', (t) => {
  const root = fixture(t, {
    '.hidden/index.md': md({ title: '隐藏分组' }),
    '.draft.md': md({ title: '草稿' }),
    'cloud/index.md': md({ title: '云账单篇' }),
  })
  assert.deepEqual(buildSidebar(root).map((i) => i.text), ['云账单篇'])
})

test('node_modules/dist/public 目录不会进入侧边栏', (t) => {
  const root = fixture(t, {
    'node_modules/index.md': md({ title: '依赖' }),
    'dist/index.md': md({ title: '产物' }),
    'public/index.md': md({ title: '静态资源' }),
    'cloud/index.md': md({ title: '云账单篇' }),
  })
  assert.deepEqual(buildSidebar(root).map((i) => i.text), ['云账单篇'])
})

test('.vitepress 目录不会变成侧边栏条目', (t) => {
  const root = fixture(t, {
    '.vitepress/index.md': md({ title: '内部配置' }),
    '.vitepress/config.mts': 'export default {}',
    'cloud/index.md': md({ title: '云账单篇' }),
  })
  const sidebar = buildSidebar(root)
  assert.deepEqual(sidebar.map((i) => i.text), ['云账单篇'])
  assert.equal(sidebar.some((i) => i.text === '内部配置'), false)
})

test('嵌套层级同样跳过点开头与保留目录', (t) => {
  const root = fixture(t, {
    'cloud/index.md': md({ title: '云账单篇' }),
    'cloud/.hidden/index.md': md({ title: '隐藏分组' }),
    'cloud/node_modules/index.md': md({ title: '依赖' }),
    'cloud/ok.md': md({ title: '正常条目' }),
  })
  const items = buildSidebar(root)[0].items ?? []
  assert.deepEqual(items.map((i) => i.text), ['正常条目'])
})

test('相同内容、不同写入顺序产生完全一致的侧边栏', (t) => {
  const files = {
    'a.md': md({ title: '同名' }),
    'b.md': md({ title: '同名' }),
    'c.md': md({ title: '同名' }),
  }
  const first = buildSidebar(fixture(t, files))
  const second = buildSidebar(
    fixture(t, { 'c.md': files['c.md'], 'a.md': files['a.md'], 'b.md': files['b.md'] }),
  )
  assert.deepEqual(first.map((i) => i.link), ['/a', '/b', '/c'])
  assert.deepEqual(first, second)
})

test('frontmatter 解析失败时错误信息包含文件路径', (t) => {
  const root = fixture(t, { 'bad.md': '---\ntitle: "未闭合\n---\n\n正文' })
  assert.throws(() => buildSidebar(root), /frontmatter 解析失败/)
  assert.throws(() => buildSidebar(root), /bad\.md/)
})
