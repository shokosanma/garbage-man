# garbage-man 站点基础设施 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建成一个可本地预览、可推送自动上线的 VitePress 博客站点骨架，具备目录树驱动的导航、仓库/价签风深色主题、账本卡片组件，并为后续内容创作预留完整骨架。

**Architecture:** VitePress root = `docs/`，内容与主题都在 `docs/` 下；构建产物输出到仓库根 `dist/`（GitHub Pages 部署源）。侧边栏由 `docs/.vitepress/sidebar.ts` 在 config 加载时同步扫描 `docs/` 目录树生成，不产出也不提交任何生成文件。测试分两层：`node:test` 单元测试覆盖侧边栏生成逻辑，集成测试对构建产物 HTML 做断言。

**Tech Stack:** VitePress 1.6.4 / Vue 3.5 / Node 24（本地）/ Node 22（CI）/ gray-matter 4.0.3 / node:test 原生 TS 类型剥离

**Spec:** `specs/2026-10-26-garbage-man-blog-design.md`

## Global Constraints

- Node.js 本地 24.5.0，CI 用 Node 22 LTS；VitePress 版本固定 `^1.6.4`，不得升级到 2.x。
- 站点 root = `docs/`，构建产物 = 仓库根 `dist/`。`docs/.vitepress/dist` 与 `docs/.vitepress/cache` 均不入库。
- `base: '/garbage-man/'`，`appearance: 'force-dark'` —— 站点锁定深色，不提供明暗切换。
- **禁止任何外链字体**。仅用系统字体栈，`--vp-font-family-mono` 用于价格、参数、命令行。
  另：VitePress 默认主题会自带并 preload Inter（16 个 woff2 / 652K）。必须用
  `vitepress/theme-without-fonts` 替代 `vitepress/theme` —— 它不 import `styles/fonts.css`，
  字体文件与 preload 标签就都不会进产物（实测产物从 ~950K 降到 296K）。
- 侧边栏唯一数据源是 `docs/` 目录树；不提交任何生成文件，不维护手写菜单。
- `gray-matter` 必须真实安装在 `devDependencies` —— VitePress 的 config 打包器不内联 node_modules 依赖，缺失时构建报 `ERR_MODULE_NOT_FOUND`。
- 内容 frontmatter 字段命名严格按 spec 第 4 节：`title` / `description` / `date` / `order` / `sidebar_label` / `cloud` / `tags`；账本额外字段 `acquired` / `price` / `condition` / `source` / `specs` / `verdict` / `step`。
- 每个目录的 `index.md` 是该分组的清单文件，缺它则整个目录不进侧边栏。
- VitePress 默认对 **Markdown 正文里的链接** 做死链检查并让构建失败（`ignoreDeadLinks` 默认 false）。这是刻意保留的：新增链接必须同时创建目标页，否则 `npm run build` 会直接报错。
- 前端代码注释仅在解释「为什么」时写，不写逐行解释。
- **每个内容页面正文必须有一个可见的 H1。** VitePress 1.6.4 的默认主题**不会**把 frontmatter 的
  `title` 渲染成 H1 —— frontmatter 的 title 只用于浏览器标题、侧边栏文字和文档大纲。
  不写 `# 标题`，页面上一个标题都看不见（实测产物里 `<h1>` 计数为 0）。
  三种页面的写法：
  - 普通页 / 目录页：正文**第一行**就是 `# <frontmatter 的 title>`
  - 带 `<StepBadge />` 的页：徽章在标题**上方**（徽章是行内元素，当 eyebrow 用）——
    `<StepBadge />` → 空行 → `# <title>`
  - 带 `<LedgerCard />` 的页：卡片是块级元素，放在标题**下方**——
    `# <title>` → 空行 → `<LedgerCard />`
  - `layout: home` 的**首页例外**：VitePress 的 `VPHomeHero` 渲染的 hero **本身就是 `<h1>`**
    （实测是 `<h1 class="heading">`，`name` 是它里面的 `<span class="name clip">`），
    所以首页正文**不需要**再写 H1。

---

### Task 1: 工程脚手架与依赖安装

**Files:**
- Create: `package.json`
- Create: `.npmrc`
- Create: `.gitignore`

**Interfaces:**
- Consumes: 无
- Produces: npm scripts `dev` / `build` / `preview` / `test:unit` / `test:build` / `test`；已安装的 `vitepress` / `vue` / `gray-matter`；`.npmrc` 中的 `noproxy=*` 代理绕过规则

- [ ] **Step 1: 写 `.npmrc` 绕过失效代理**

本机 `HTTP_PROXY`/`HTTPS_PROXY` 指向已下线的 `node-rpi:9081`，npm 会长时间挂起。`noproxy=*` 已实测有效（`npm view` 由挂起变为 0.5s 返回）。

```bash
cat > .npmrc <<'EOF'
noproxy=*
EOF
```

- [ ] **Step 2: 写 `.gitignore`**

```bash
cat > .gitignore <<'EOF'
node_modules
dist
docs/.vitepress/dist
docs/.vitepress/cache
*.log
.DS_Store
.vscode
.idea
EOF
```

- [ ] **Step 3: 写 `package.json`**

```json
{
  "name": "garbage-man",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "从云账单和废品堆里，捡回被丢掉的钱",
  "scripts": {
    "dev": "vitepress dev docs",
    "build": "vitepress build docs",
    "preview": "vitepress preview docs",
    "test:unit": "node --test tests/sidebar.test.ts",
    "test:build": "node --test tests/build.test.mjs",
    "test": "npm run test:unit && npm run build && npm run test:build"
  },
  "devDependencies": {
    "gray-matter": "^4.0.3",
    "vitepress": "^1.6.4",
    "vue": "^3.5.13"
  }
}
```

- [ ] **Step 4: 安装依赖**

Run: `npm install`
Expected: 退出码 0，输出 `added N packages`，耗时 < 60s。

若仍然挂起，改用兜底命令并跳过本步的 `.npmrc`：

Run: `env -u HTTP_PROXY -u HTTPS_PROXY npm install`
Expected: 同上。

- [ ] **Step 5: 验证工具链可用**

Run: `node -p "require('vitepress/package.json').version" && node -e "import('gray-matter').then(m=>console.log('gray-matter ok', typeof m.default))"`
Expected: 输出 `1.6.4`，以及 `gray-matter ok function`。

> 不要用 `npx vitepress --version` —— VitePress 1.6.4 的 CLI 没有 `--version` 分支（`node_modules/vitepress/dist/node/cli.js:406` 打印 banner 后直接进 dev server 分支），命令会挂住并在仓库根留下 `.vitepress/cache`。

- [ ] **Step 6: 提交**

```bash
git add package.json .npmrc .gitignore package-lock.json
git commit -m "chore: scaffold project with vitepress toolchain"
```

---

### Task 2: VitePress 基础配置与最小站点

**Files:**
- Create: `docs/.vitepress/config.mts`
- Create: `docs/.vitepress/theme/index.ts`
- Create: `docs/index.md`

**Interfaces:**
- Consumes: Task 1 的 npm scripts 与依赖
- Produces: 可构建的最小站点，产物位于 `dist/`；`docs/.vitepress/theme/index.ts` 默认导出 theme 对象，后续任务在此注册组件

- [ ] **Step 1: 写 `docs/.vitepress/theme/index.ts`**

```ts
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'

export default {
  extends: DefaultTheme,
} satisfies Theme
```

- [ ] **Step 2: 写 `docs/.vitepress/config.mts`**

先不接侧边栏（Task 3 才实现），此处留 `sidebar: []`。

```ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  srcDir: '.',
  outDir: '../dist',
  base: '/garbage-man/',
  lang: 'zh-CN',
  appearance: 'force-dark',
  title: 'garbage-man',
  description: '从云账单和废品堆里，捡回被丢掉的钱',
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '云账单', link: '/cloud/' },
      { text: '二手硬件', link: '/hardware/' },
    ],
    sidebar: [],
  },
})
```

- [ ] **Step 3: 写 `docs/index.md`**

```md
---
layout: home
title: garbage-man
hero:
  name: garbage-man
  text: 从云账单和废品堆里，捡回被丢掉的钱
  tagline: 云上的闲置资源是垃圾，实体废品堆也是垃圾。这个仓库记录怎么把它们捡回来。
---
```

- [ ] **Step 4: 构建并验证产物位置**

Run: `npm run build`
Expected: 退出码 0，输出 `build complete in Xs`。

Run: `ls dist/index.html && ls dist/assets | head -3`
Expected: `dist/index.html` 存在，`dist/assets/` 下有 css/js 文件。

**若 `dist/` 不在仓库根**：检查 `config.mts` 的 `outDir` 值。VitePress 将 `outDir` 相对 root（即 `docs/`）解析，`'../dist'` 即仓库根 `dist/`。若构建报错 `outDir must be inside`，改为 `outDir: '.vitepress/dist'` 并同步更新 Task 8 的 CI `path` 与 Task 5 的测试路径常量 —— 两处必须一起改。

- [ ] **Step 5: 验证 base 前缀已生效**

Run: `grep -o '/garbage-man/assets/[a-zA-Z0-9._-]*' dist/index.html | head -2`
Expected: 输出两行以 `/garbage-man/assets/` 开头的路径。

- [ ] **Step 6: 提交**

```bash
git add docs/.vitepress/config.mts docs/.vitepress/theme/index.ts docs/index.md
git commit -m "feat: add minimal vitepress site with base path"
```

---

### Task 3: 侧边栏生成器（TDD）

**Files:**
- Create: `tests/sidebar.test.ts`
- Create: `docs/.vitepress/sidebar.ts`
- Modify: `docs/.vitepress/config.mts`

**Interfaces:**
- Consumes: Task 1 的 `gray-matter` 与 `node --test`
- Produces: `buildSidebar(srcDir: string): SidebarItem[]`；`SidebarItem` 接口 `{ text: string; link?: string; collapsed?: boolean; items?: SidebarItem[] }`

- [ ] **Step 1: 写失败的测试 `tests/sidebar.test.ts`**

```ts
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
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm run test:unit`
Expected: FAIL，报错包含 `Cannot find module` 或 `ERR_MODULE_NOT_FOUND`，指向 `../docs/.vitepress/sidebar.ts`。

- [ ] **Step 3: 实现 `docs/.vitepress/sidebar.ts`**

```ts
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

export interface SidebarItem {
  text: string
  link?: string
  collapsed?: boolean
  items?: SidebarItem[]
}

interface Frontmatter {
  title?: string
  sidebar_label?: string
  order?: number
}

interface OrderedItem extends SidebarItem {
  _order: number
  _kind: 'dir' | 'file'
  _path: string
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'public'])
const DEFAULT_ORDER = 999

function readFrontmatter(file: string): Frontmatter {
  if (!fs.existsSync(file)) return {}
  try {
    // 传 options 绕开 gray-matter 的内容缓存：它会在解析前写入缓存，
    // 解析失败后同一内容再解析会静默返回空 frontmatter，错误也随之消失。
    const { data } = matter(fs.readFileSync(file, 'utf8'), {})
    return data as Frontmatter
  } catch (err) {
    throw new Error(`[sidebar] frontmatter 解析失败: ${file}`, { cause: err })
  }
}

function resolveOrder(order: unknown): number {
  if (order === undefined || order === null || order === '') return DEFAULT_ORDER
  const n = Number(order)
  return Number.isFinite(n) ? n : DEFAULT_ORDER
}

function relPath(srcDir: string, absFile: string): string {
  return path.relative(srcDir, absFile).split(path.sep).join('/')
}

function toUrl(srcDir: string, absFile: string): string {
  const rel = relPath(srcDir, absFile)
  if (rel === 'index.md') return '/'
  if (rel.endsWith('/index.md')) return '/' + rel.slice(0, -'index.md'.length)
  return '/' + rel.replace(/\.md$/, '')
}

function buildLeaf(fileAbs: string, srcDir: string): OrderedItem {
  const fm = readFrontmatter(fileAbs)
  return {
    text: fm.sidebar_label ?? fm.title ?? path.basename(fileAbs, '.md'),
    link: toUrl(srcDir, fileAbs),
    _order: resolveOrder(fm.order),
    _kind: 'file',
    _path: relPath(srcDir, fileAbs),
  }
}

function buildGroup(dirAbs: string, srcDir: string): OrderedItem | null {
  const indexFile = path.join(dirAbs, 'index.md')
  if (!fs.existsSync(indexFile)) return null
  const fm = readFrontmatter(indexFile)
  return {
    text: fm.sidebar_label ?? fm.title ?? path.basename(dirAbs),
    link: toUrl(srcDir, indexFile),
    collapsed: false,
    items: buildChildren(dirAbs, srcDir),
    _order: resolveOrder(fm.order),
    _kind: 'dir',
    _path: relPath(srcDir, indexFile),
  }
}

function buildChildren(dirAbs: string, srcDir: string): SidebarItem[] {
  const collected: OrderedItem[] = []
  for (const entry of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
    const abs = path.join(dirAbs, entry.name)
    if (entry.isDirectory()) {
      const group = buildGroup(abs, srcDir)
      if (group) collected.push(group)
    } else if (entry.name.endsWith('.md') && entry.name !== 'index.md') {
      collected.push(buildLeaf(abs, srcDir))
    }
  }
  return collected.sort(compare).map(strip)
}

function compare(a: OrderedItem, b: OrderedItem): number {
  if (a._order !== b._order) return a._order - b._order
  if (a._kind !== b._kind) return a._kind === 'file' ? -1 : 1
  const byText = a.text.localeCompare(b.text, 'zh-Hans-CN')
  if (byText !== 0) return byText
  if (a._path === b._path) return 0
  return a._path < b._path ? -1 : 1
}

function strip(item: OrderedItem): SidebarItem {
  const { _order, _kind, _path, ...rest } = item
  return rest
}

export function buildSidebar(srcDir: string): SidebarItem[] {
  const root = path.resolve(srcDir)
  if (!fs.existsSync(root)) {
    throw new Error(`[sidebar] 内容目录不存在: ${root}`)
  }
  return buildChildren(root, root)
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm run test:unit`
Expected: PASS，12 个测试全部通过（`pass 12 / fail 0`）。

- [ ] **Step 5: 接入 config**

改 `docs/.vitepress/config.mts`：

```ts
import { defineConfig } from 'vitepress'
import path from 'node:path'
import { buildSidebar } from './sidebar.ts'

// 以配置文件自身位置推导内容根，与调用方的 cwd 无关。
const CONTENT_ROOT = path.resolve(import.meta.dirname, '..')

export default defineConfig({
  srcDir: '.',
  outDir: '../dist',
  base: '/garbage-man/',
  appearance: 'force-dark',
  title: 'garbage-man',
  description: '从云账单和废品堆里，捡回被丢掉的钱',
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '云账单', link: '/cloud/' },
      { text: '二手硬件', link: '/hardware/' },
    ],
    sidebar: buildSidebar(CONTENT_ROOT),
  },
})
```

以配置文件自身位置推导内容根，与调用方的 cwd 无关：从任何目录调用 vitepress 都指向同一个 `docs/`。
（实现时曾用 `process.cwd()`，在 npm script 里恒为仓库根，但从别的目录调用会指向错误的位置 —— 已改为 `import.meta.dirname`。）

- [ ] **Step 6: 构建验证**

Run: `npm run build`
Expected: 退出码 0。此时 `docs/` 下还没有内容目录，`sidebar` 应为空数组，构建仍应成功。

- [ ] **Step 7: 提交**

```bash
git add tests/sidebar.test.ts docs/.vitepress/sidebar.ts docs/.vitepress/config.mts
git commit -m "feat: generate sidebar from content directory tree"
```

---

### Task 4: 仓库/价签风主题样式

**Files:**
- Create: `docs/.vitepress/theme/style.css`
- Modify: `docs/.vitepress/theme/index.ts`

**Interfaces:**
- Consumes: Task 2 的 theme 入口
- Produces: CSS 变量与 `.ledger-card` / `.step-badge` 类名约定，供 Task 5、6 的组件直接使用

- [ ] **Step 1: 写 `docs/.vitepress/theme/style.css`**

```css
:root {
  --vp-c-bg: #0d1117;
  --vp-c-bg-alt: #161b22;
  --vp-c-bg-soft: #1c2129;
  --vp-c-bg-elv: #21262d;
  --vp-c-border: #30363d;
  --vp-c-divider: #30363d;
  --vp-c-gutter: #0d1117;
  --vp-c-text-1: #e6edf3;
  --vp-c-text-2: #9aa4b2;
  --vp-c-text-3: #8b949e;
  --vp-c-brand-1: #00e27a;
  --vp-c-brand-2: #00b862;
  --vp-c-brand-3: #00a354;
  --vp-c-brand-soft: rgba(0, 226, 122, 0.14);

  --gm-warn: #ffc400;
  --gm-danger: #ff6b6b;

  /* 品牌按钮底色是荧光绿系，白字压上去对比度不足，改用页面底色做文字 */
  --vp-button-brand-text: #0d1117;
  --vp-button-brand-hover-text: #0d1117;
  --vp-button-brand-active-text: #0d1117;

  --vp-font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif;
  --vp-font-family-mono: ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, Consolas,
    'Liberation Mono', monospace;

  --vp-layout-max-width: 1440px;
}

/* ---------- 价签卡片 ---------- */

.ledger-card {
  position: relative;
  margin: 0 0 2rem;
  padding: 1.25rem 1.25rem 1.25rem 2.75rem;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 10px;
  background: linear-gradient(180deg, var(--vp-c-bg-soft), var(--vp-c-bg-alt));
}

/* 打孔柱要跟着卡片高度伸缩，所以不能写死孔的数量：
   孔洞用径向渐变平铺，repeat:round 会把末孔完整地收在卡片底部，不会裁成半圆。 */
.ledger-card::before {
  content: '';
  position: absolute;
  left: 14px;
  top: 20px;
  bottom: 20px;
  width: 10px;
  background-image: radial-gradient(circle at 5px 5px, var(--vp-c-bg) 5px, transparent 5px);
  background-size: 10px 30px;
  background-repeat: round;
}

.ledger-card__tag {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 0.9rem;
}

.ledger-card__verdict {
  padding: 0.1rem 0.6rem;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  background: transparent;
}

.ledger-card__verdict.is-good {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.ledger-card__verdict.is-meh {
  color: var(--gm-warn);
  background: rgba(255, 196, 0, 0.12);
}

.ledger-card__verdict.is-bad {
  color: var(--gm-danger);
  background: rgba(255, 107, 107, 0.12);
}

.ledger-card__price {
  font-family: var(--vp-font-family-mono);
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1;
  color: var(--vp-c-brand-1);
}

.ledger-card__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1.5rem;
  margin: 0 0 1rem;
}

.ledger-card__facts > div {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.ledger-card__facts dt {
  margin: 0;
  font-size: 0.82rem;
  color: var(--vp-c-text-3);
}

.ledger-card__facts dd {
  margin: 0;
  font-size: 0.9rem;
  color: var(--vp-c-text-1);
}

/* 价签卡在正文里，VitePress 的 .vp-doc table 系列规则会漏进来
   （块级窄表、斑马纹、四边框线、表头色块、14px 字号）。
   这里统一加上 .ledger-card 前缀把特异性抬到 (0,2,x)，逐项复位。 */
.ledger-card .ledger-card__specs {
  display: table;
  width: 100%;
  margin: 0;
  overflow: visible;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.ledger-card .ledger-card__specs tr {
  background-color: transparent;
  border-top: none;
}

.ledger-card .ledger-card__specs tr:nth-child(2n) {
  background-color: transparent;
}

/* 序列号 / URL 这类无空格长串必须能断行，否则单元格的 min-content 宽度
   会把整张表撑到卡片外面去。
   用 anywhere 而不是 break-word：只有 anywhere 会把「任意位置可断」计入
   min-content 计算，break-word 不参与，挡不住表格撑破。 */
.ledger-card .ledger-card__specs th,
.ledger-card .ledger-card__specs td {
  padding: 0.35rem 0.6rem;
  border: none;
  border-top: 1px solid var(--vp-c-divider);
  background-color: transparent;
  font-size: inherit;
  text-align: left;
  overflow-wrap: anywhere;
}

.ledger-card .ledger-card__specs th {
  width: 5.5rem;
  font-weight: 400;
  color: var(--vp-c-text-3);
}

.ledger-card .ledger-card__specs td {
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-1);
}

/* ---------- 步骤徽章 ---------- */

.step-badge {
  display: inline-block;
  margin-bottom: 1rem;
  padding: 0.15rem 0.7rem;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 0.82rem;
  font-weight: 600;
}

/* ---------- 导航栏 ---------- */

/* 导航栏底下的分隔线取的是 --vp-c-gutter，而我们把 gutter 调成了页面底色
   （页脚那条线需要藏起来），结果连导航栏的分隔线一起没了。
   在导航栏内部把 gutter 换回边框色；首页不需要这条线，所以排除 .home。
   VitePress 的分隔线规则带 scope 属性选择器，实际特异性是 (0,4,0)；
   之前额外写的 .VPNavBar:not(.home) .divider > div.divider-line 是 (0,4,1)
   （div 是类型选择器，占 c 位），虽能压过它们，但与上面的 token 方案重复，
   而且依赖 .divider > div.divider-line 的 DOM 形状，已删除。 */
.VPNavBar:not(.home) {
  --vp-c-gutter: var(--vp-c-border);
}

/* ---------- 首页 ---------- */

.VPHome .VPHero .name {
  font-family: var(--vp-font-family-mono);
  letter-spacing: -0.02em;
}
```

- [ ] **Step 2: 在 theme 入口引入样式**

改 `docs/.vitepress/theme/index.ts`。**注意 import 的来源是 `vitepress/theme-without-fonts`，不是 `vitepress/theme`** —— 后者会连带引入 Inter 字体文件与 preload 标签：

```ts
import DefaultTheme from 'vitepress/theme-without-fonts'
import type { Theme } from 'vitepress'
import './style.css'

export default {
  extends: DefaultTheme,
} satisfies Theme
```

- [ ] **Step 3: 构建并验证样式进入产物**

Run: `npm run build`
Expected: 退出码 0。

Run: `grep -o '#00e27a' dist/assets/style.*.css | head -1`
Expected: 输出 `#00e27a`（自定义主色已进入编译后的 CSS）。

Run: `grep -rc 'Googleapis\|fonts.googleapis' dist/assets/style.*.css`
Expected: 输出 `0` —— 确认没有引入任何外链字体。

Run: `find dist -name '*.woff2' -o -name '*.woff' -o -name '*.ttf' -o -name '*.otf' -o -name '*.eot' | wc -l`
Expected: 输出 `0` —— 一个字体文件都不该进产物（扫全树，不只 `dist/assets`）。

Run: `grep -c '@font-face' dist/assets/style.*.css`
Expected: 输出 `0` —— 不应残留任何 @font-face 规则（原计划的 `rel="preload"` 计数检不出这个）。

Run: `grep -o 'rel="preload"[^>]*font' dist/index.html | wc -l`
Expected: 输出 `0` —— 不应有字体 preload。

- [ ] **Step 4: 提交**

```bash
git add docs/.vitepress/theme/style.css docs/.vitepress/theme/index.ts
git commit -m "feat: add warehouse-style dark theme with system fonts"
```

---

### Task 5: LedgerCard 组件与构建集成测试

**Files:**
- Create: `docs/.vitepress/theme/components/LedgerCard.vue`
- Create: `docs/hardware/ledger/thinkpad-x1-carbon-gen9.md`
- Create: `tests/build.test.mjs`
- Modify: `docs/.vitepress/theme/index.ts`
- Modify: `docs/.vitepress/theme/style.css`（Task 4 复评遗留：`__facts` / `__verdict` 窄屏溢出）

**Interfaces:**
- Consumes: Task 3 的 `buildSidebar`（账本目录进侧边栏）、Task 4 的 `.ledger-card` 类名
- Produces: 全局组件 `LedgerCard`；`tests/build.test.mjs` 对 `dist/` 产物做断言

> **本任务在执行期被 Task 4 的复评回填了两处改动**（详见 `.superpowers/sdd/2026-10-26-garbage-man-infrastructure/task-5-brief.md`
> 的 Step 2 与 Step 2b）：
> ① `.ledger-card__facts dd` 加 `overflow-wrap: anywhere` —— 修长 URL 撑破整页；
> ② `.ledger-card__tag` 加 `flex-wrap: wrap`、`.ledger-card__verdict` 加 `overflow-wrap: anywhere`
> —— 修长 verdict 撑破整页；
> ③ `.ledger-card__price` 加 `overflow-wrap: anywhere` —— 修超长价格撑破整页。
> 三处都只加行，**不许重排 `style.css`**（里面的每条规则都有实测记录）。
>
> **另有一个执行期才发现的环境事实**（fix round 2 实测，定位到 Vue 编译器）：
> **SSR 的 class 顺序与客户端相反** —— `@vue/compiler-ssr` 把动态 class 拼在前面
> （产物 `<span class="is-good ledger-card__verdict">`），`@vue/compiler-dom` 把基础 class 拼在前面
> （客户端 `<span class="ledger-card__verdict is-good">`）。
> Vue 的 hydration 按 class **集合**比较，所以两者不会报 mismatch。
> **写断言时不能假定基础类在最前**，模板里怎么写 `class` / `:class` 都改变不了这个顺序。

- [ ] **Step 1: 写 `docs/.vitepress/theme/components/LedgerCard.vue`**

```vue
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
```

**注意（YAML 隐式类型陷阱）**：`date: 2026-03-15` 这类不带引号的日期，会被 gray-matter 的 YAML 引擎
（js-yaml `safeLoad`，DEFAULT_SCHEMA）解析成 **Date 对象**，不是字符串。
所以 frontmatter 里的日期一律**加引号**（`date: "2026-03-15"`）—— **这是唯一可靠的防线**。

评审实测（build 与 dev 两条路都试过）：漏加引号时，VitePress 的 `injectPageDataCode()` 会做
`JSON.parse(JSON.stringify(data))`，Date 到客户端前已经变成 ISO 串，
页面实际渲染成 `2026-03-15T00:00:00.000Z`（**不是** `Sun Mar 15 2026 …` ——
那个形态只在 gray-matter 层 `String(date)` 时出现，且用的是**本地时区**
（东八区机器上是 `GMT+0800`，UTC 机器上才是 `GMT+0000`））。
所以 `asText()` 要**两层**都认：Date 对象本身，以及被序列化过的 ISO 串。

- [ ] **Step 2: 注册组件**

改 `docs/.vitepress/theme/index.ts`：

```ts
import DefaultTheme from 'vitepress/theme-without-fonts'
import type { Theme } from 'vitepress'
import LedgerCard from './components/LedgerCard.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LedgerCard', LedgerCard)
  },
} satisfies Theme
```

- [ ] **Step 3: 建一篇账本示例页**

创建 `docs/hardware/ledger/thinkpad-x1-carbon-gen9.md`。这是一篇**占位示例**，真实数据由作者后续替换：

```md
---
title: ThinkPad X1 Carbon Gen 9
description: 二手轻薄本价格锚点的观察样本
date: "2026-10-26"
acquired: "2026-03-15"
price: 3200
condition: 95新
source: 闲鱼
verdict: 值
specs:
  cpu: i7-1185G7
  ram: 16G
  storage: 1T NVMe
  screen: 14" 2.8K OLED
---

# ThinkPad X1 Carbon Gen 9

<LedgerCard />

## 到手实测

<!-- 待填：开机、屏幕、键盘、电池健康度、接口实测 -->

## 翻车点

<!-- 待填：踩到的坑与处理方式 -->

## 值不值

<!-- 待填：结论与同类价格对比 -->
```

- [ ] **Step 4: 写集成测试 `tests/build.test.mjs`**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const DIST = path.resolve(import.meta.dirname, '..', 'dist')

function html(...segments) {
  return fs.readFileSync(path.join(DIST, ...segments), 'utf8')
}

function exists(...segments) {
  return fs.existsSync(path.join(DIST, ...segments))
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

test('首页已生成', () => {
  assert.ok(exists('index.html'))
})

test('资源链接带 base 前缀', () => {
  assert.match(html('index.html'), /\/garbage-man\/assets\//)
})

test('账本卡片渲染 frontmatter 字段', () => {
  const page = html('hardware', 'ledger', 'thinkpad-x1-carbon-gen9.html')
  assert.match(page, /¥3200(?![.\d])/)
  assert.match(page, /is-good/)
  assert.match(page, /i7-1185G7/)
  assert.match(page, /95新/)
})

// 价签的修饰符是 Task 4 ↔ Task 5 ↔ Task 6 之间唯一的 class 契约。
// 白名单断言比「查 is-none 不存在」更强：它同时挡得住拼错的 is-goodd，
// 和将来有人误加的第四个修饰符。
const MODIFIERS = ['is-good', 'is-meh', 'is-bad']

const COMPONENT = path.resolve(
  import.meta.dirname,
  '..',
  'docs',
  '.vitepress',
  'theme',
  'components',
  'LedgerCard.vue',
)

function verdictModifiers(page) {
  // SSR 编译出的 class 顺序**不是稳定契约**：@vue/compiler-ssr 有两条路径，
  // 一条把动态 class 拼在前面、一条把静态 class 拼在前面；客户端 @vue/compiler-dom
  // 又是一种顺序；dev 模式干脆不发 SSR 内容，纯客户端渲染。
  // Vue 的 hydration 按 class **集合**比较，所以顺序不同不会报 mismatch。
  // 因此只能按「包含 ledger-card__verdict 的 class 属性」整体取，不能假定基础类在最前。
  return [...page.matchAll(/class="([^"]*ledger-card__verdict[^"]*)"/g)]
    .flatMap((m) => m[1].trim().split(/\s+/))
    .filter((name) => name !== 'ledger-card__verdict')
}

test('价签的修饰符不越出契约', () => {
  // 扫全部页面而不是只扫一张：Task 6 还会往账本里加页面，
  // 任何一张卡片的修饰符越界都要抓得到。
  const pages = walk(DIST).filter((f) => f.endsWith('.html'))
  const rendered = pages.flatMap((file) =>
    verdictModifiers(fs.readFileSync(file, 'utf8')).map((name) => [file, name]),
  )
  assert.ok(rendered.length > 0, '产物里没找到价签的 class')
  for (const [file, name] of rendered) {
    assert.ok(MODIFIERS.includes(name), `${file} 里出现了契约外的修饰符：${name}`)
  }

  // 产物里没有未知 verdict 的卡片时，渲染结果看不出兜底分支，
  // 也看不出暂时没人用的映射项。所以兜底值和映射表都得从组件源码里守。
  assert.ok(fs.existsSync(COMPONENT), '找不到价签组件源码，断言可能已经失效')
  const component = fs.readFileSync(COMPONENT, 'utf8')

  // 兜底值必须是空串：编译产物里只有压缩过的 ?? 片段，靠不住。
  // 正则锚在声明行上（^ + [^\n]*），免得注释里出现同款写法就误报。
  const fallback = component.match(
    /^\s*const\s+verdictClass\b[^\n]*VERDICT_CLASS\[fm\.verdict\]\s*\?\?\s*(['"])(.*?)\1/m,
  )
  assert.ok(fallback, '没找到价签的兜底逻辑，断言可能已经失效')
  assert.ok(fallback[2] === '', `出现了契约外的修饰符：is-${fallback[2]}`)

  // 映射表的值也必须在契约内：加了第四个修饰符但暂时还没有页面用到时，
  // 产物里根本看不见，只有源码能看见。
  const table = component.match(/VERDICT_CLASS[^=]*=\s*\{([^}]*)\}/s)
  assert.ok(table, '没找到价签的修饰符映射表，断言可能已经失效')
  // 先剥掉行注释，免得注释里写的旧写法被当成映射项。
  const entries = table[1].replace(/\/\/[^\n]*/g, '')
  // 三种引号都要认：值写成反引号时不能悄悄提取不到、然后循环一次都不执行。
  const values = [...entries.matchAll(/:\s*(['"`])([^'"`]*)\1/g)].map((m) => m[2])
  assert.ok(values.length > 0, '没从映射表里提取到任何修饰符值，断言可能已经失效')
  for (const name of values) {
    assert.ok(['good', 'meh', 'bad'].includes(name), `映射表里出现了契约外的修饰符：is-${name}`)
  }
})

// 零字体契约唯一的自动化关卡：Task 8 的 CI 只跑这三个 npm script。
// 原来这条只查 googleapis/gstatic，查不出 VitePress 自带的本地 Inter woff2 ——
// 把主题入口退回 vitepress/theme 时，产物里会多出 14 个 woff2、1 条 @font-face，
// 以及每个 HTML 页各 1 条字体 preload（产物体积随页数线性增长）。
test('产物里没有任何字体', () => {
  const files = walk(DIST)

  const fontFiles = files.filter((f) => /\.(woff2?|ttf|otf|eot)$/i.test(f))
  assert.deepEqual(fontFiles, [], `产物里出现了字体文件：${fontFiles.join(', ')}`)

  for (const file of files.filter((f) => f.endsWith('.css'))) {
    const css = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(css, /@font-face/, `${file} 里出现了 @font-face`)
    assert.doesNotMatch(css, /fonts\.googleapis|fonts\.gstatic/i, `${file} 里出现了外链字体`)
  }

  for (const file of files.filter((f) => f.endsWith('.html'))) {
    const page = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(page, /rel="preload"[^>]*font/, `${file} 里出现了字体 preload`)
  }
})
```

- [ ] **Step 5: 构建并运行集成测试**

Run: `npm run build && npm run test:build`
Expected: `pass 5 / fail 0`（首页已生成 / 资源链接带 base 前缀 / 账本卡片渲染 frontmatter 字段 /
价签的修饰符不越出契约 / 产物里没有任何字体）。

若 `¥3200` 断言失败但页面存在：检查 `docs/hardware/ledger/thinkpad-x1-carbon-gen9.md` 的 frontmatter 是否被解析 —— `price: 3200` 必须是数字，`verdict: 值` 若是带空格的字符串需加引号。

- [ ] **Step 6: 提交**

```bash
git add docs/.vitepress/theme/components/LedgerCard.vue docs/.vitepress/theme/index.ts docs/hardware/ledger/thinkpad-x1-carbon-gen9.md tests/build.test.mjs
git commit -m "feat: add LedgerCard component and build output tests"
```

---

### Task 6: 内容骨架与 StepBadge 组件

**Files:**
- Create: `docs/.vitepress/theme/components/StepBadge.vue`
- Create: `docs/cloud/index.md`
- Create: `docs/cloud/overview.md`
- Create: `docs/cloud/visibility/index.md`
- Create: `docs/cloud/identify/index.md`
- Create: `docs/cloud/dispose/index.md`
- Create: `docs/cloud/prevent/index.md`
- Create: `docs/hardware/index.md`
- Create: `docs/hardware/guide/index.md`
- Create: `docs/hardware/ledger/index.md`
- Modify: `docs/.vitepress/theme/index.ts`

**Interfaces:**
- Consumes: Task 3 的 `buildSidebar`、Task 4 的 `.step-badge` 类名
- Produces: 全局组件 `StepBadge`；完整的目录骨架，四个云步骤分组按 `order` 排序

- [ ] **Step 1: 写 `docs/.vitepress/theme/components/StepBadge.vue`**

```vue
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
```

- [ ] **Step 2: 注册 `StepBadge`**

改 `docs/.vitepress/theme/index.ts`，在 `enhanceApp` 中追加：

```ts
    app.component('StepBadge', StepBadge)
```

同时在文件顶部加 `import StepBadge from './components/StepBadge.vue'`。

- [ ] **Step 3: 写云账单篇骨架**

`docs/cloud/index.md`：

```md
---
title: 云账单篇
sidebar_label: 云账单
description: 用四步法把云上被浪费的钱捡回来
order: 1
---

# 云账单篇

云上闲置资源是「垃圾」。这篇用 **看见 → 识别 → 处置 → 防复发** 四步法，
把账单里的水分一点点挤出来。

- [① 看见 · 成本可见性](/cloud/visibility/) —— 先让钱花在看得见的地方
- [② 识别 · 找到垃圾](/cloud/identify/) —— 空跑实例、闲置资源、计费错配
- [③ 处置 · 删降换](/cloud/dispose/) —— 三种手法处理掉
- [④ 防复发 · 机制](/cloud/prevent/) —— 让垃圾不再堆积

先读 [四步法总纲](/cloud/overview)。
```

`docs/cloud/overview.md`：

```md
---
title: 四步法总纲
description: 云账单降本的通用框架
date: "2026-10-26"
tags: [方法论]
order: 1
---

# 四步法总纲

<!-- 待填：本篇写通用方法论，不涉及厂商特有细节 -->
```

四个步骤目录的 `index.md`，以 `docs/cloud/visibility/index.md` 为例：

```md
---
title: ① 看见 · 成本可见性
description: 让每一分钱都有归属
order: 2
step: visibility
---

<StepBadge />

# ① 看见 · 成本可见性

看不见的钱花不掉。这一步解决三个问题：

- 账单能不能拆到团队 / 项目 / 人
- 成本基线是什么，异常怎么被发现
- 预算告警挂在哪一层

<!-- 待填：目录页先给问题清单，具体厂商文章后续补 -->
```

其余三个同构，标题 / order / step 依次为：

| 文件 | title | order | step |
|---|---|---|---|
| `docs/cloud/identify/index.md` | ② 识别 · 找到垃圾 | 3 | `identify` |
| `docs/cloud/dispose/index.md` | ③ 处置 · 删降换 | 4 | `dispose` |
| `docs/cloud/prevent/index.md` | ④ 防复发 · 机制 | 5 | `prevent` |

各目录的 `index.md` 正文暂列 2–3 条问题清单即可，标 `<!-- 待填 -->`。

**每个目录页的正文首行必须是 `# <title>`** —— VitePress 1.6.4 的默认主题**不会**把 frontmatter 的
`title` 渲染成 H1（frontmatter 的 title 只用于浏览器标题、侧边栏文字和文档大纲），
不写 H1，页面上一个标题都看不见。上面的 `visibility` 页已经带了，
**另外三个目录页（identify / dispose / prevent）同样要带**，
写法和 `visibility` 完全同构：`<StepBadge />` → 空行 → `# <title>` → 空行 → 问题清单。

**为什么这四个页面要带 `step:` 和 `<StepBadge />`**：
Task 9 的 README 会写「云文章的步骤徽章」这条约定 —— frontmatter 里写 `step:`，
正文首行加 `<StepBadge />`，页面顶部出现对应步骤的荧光徽章。
**这四个页面就是这条约定的第一批发起者** —— 如果骨架页自己都不带，
组件就永远是死代码，约定也永远是空话。所以 `step:` 字段和 `<StepBadge />` 是这两个页面的
**必填项**，不是可选项。`StepBadge` 组件的映射表只认这四个值：

| frontmatter 的 `step` | 徽章文字 |
|---|---|
| `visibility` | ① 看见 |
| `identify` | ② 识别 |
| `dispose` | ③ 处置 |
| `prevent` | ④ 防复发 |

其它值一律渲染成空（`v-if` 不渲染）。**不要在这四个值之外另造。**

- [ ] **Step 4: 写二手硬件篇骨架**

`docs/hardware/index.md`：

```md
---
title: 二手硬件篇
sidebar_label: 二手硬件
description: 从废品堆里捡回来的机器，和它们的真实价格
order: 2
---

# 二手硬件篇

实体废品堆也是「垃圾」。这一篇记两类东西：

- [淘货账本](/hardware/ledger/) —— 一台机器一篇：入手价、成色、实测、值不值
- [硬件专题](/hardware/guide/) —— 渠道、验机、型号图鉴、翻车案例
```

`docs/hardware/ledger/index.md`：

```md
---
title: 淘货账本
description: 每台捡回来的机器一页
order: 1
---

# 淘货账本

一台机器一页，记四件事：**多少钱、从哪来、到手什么样、值不值**。

<!-- 待填：账本说明与挑选标准 -->
```

`docs/hardware/guide/index.md`：

```md
---
title: 硬件专题
description: 捡漏方法与避坑指南
order: 2
---

# 硬件专题

<!-- 待填：专题目录 -->
```

- [ ] **Step 5: 构建并验证侧边栏结构**

Run: `npm run build`
Expected: 退出码 0。

Run: `node -e "const s=require('node:fs').readFileSync('dist/cloud/index.html','utf8'); for(const t of ['云账单篇','二手硬件','① 看见','② 识别','③ 处置','④ 防复发','淘货账本','硬件专题']) console.log(t, s.includes(t)?'OK':'MISSING')"`
Expected: 八项全部 `OK`。

Run: `node -e "const f=require('node:fs'); for(const p of ['visibility','identify','dispose','prevent']) { const s=f.readFileSync('dist/cloud/'+p+'/index.html','utf8'); console.log(p, s.includes('step-badge')?'OK':'MISSING') }"`
Expected: 四项全部 `OK` —— **徽章必须真的渲染出来**，不是组件注册了就算数。

另外确认侧边栏（`docs/hardware/ledger/thinkpad-x1-carbon-gen9.md` 这篇账本示例页）
在本任务建了 `docs/hardware/index.md` 之后**自动出现在侧边栏里**了 —— 它此前一直不在。

- [ ] **Step 6: 提交**

```bash
git add docs/.vitepress/theme/components/StepBadge.vue docs/.vitepress/theme/index.ts docs/cloud docs/hardware
git commit -m "feat: add content skeleton and StepBadge component"
```

---

### Task 7: 首页

**Files:**
- Modify: `docs/index.md`

**Interfaces:**
- Consumes: Task 4 的主题变量
- Produces: 首页 Hero + 四大步骤卡片 + 两大主线入口

- [ ] **Step 1: 写首页**

```md
---
layout: home
title: garbage-man
description: 从云账单和废品堆里，捡回被丢掉的钱
hero:
  name: garbage-man
  text: 从云账单和废品堆里，捡回被丢掉的钱
  tagline: 云上的闲置资源是垃圾，实体废品堆也是垃圾。这个仓库记录怎么把它们捡回来。
  actions:
    - theme: brand
      text: 云账单篇
      link: /cloud/
    - theme: alt
      text: 二手硬件篇
      link: /hardware/
features:
  - title: ① 看见
    details: 成本可见性。账单拆分、标签归集、成本分摊 —— 先让每一分钱都有归属。
  - title: ② 识别
    details: 找到垃圾。空跑实例、未挂载磁盘、闲置 EIP、堆积快照、错配的计费模式。
  - title: ③ 处置
    details: 三种手法。直接删掉、降配缩容、换成更便宜的计费形态。
  - title: ④ 防复发
    details: 机制兜底。标签规范、自动清理任务、预算告警，让垃圾不再堆积。
---

## 两大主线

- **[云账单篇](/cloud/)** —— 阿里云 / 腾讯云 / 华为云的成本治理实操。
- **[二手硬件篇](/hardware/)** —— 淘货账本与捡漏专题。
```

- [ ] **Step 2: 构建并验证**

Run: `npm run build && npm run test:build`
Expected: `pass 5 / fail 0`（首页已生成 / 资源链接带 base 前缀 / 账本卡片渲染 frontmatter 字段 /
价签的修饰符不越出契约 / 产物里没有任何字体）。

Run: `grep -o '捡回被丢掉的钱' dist/index.html | head -1`
Expected: 输出一次。

Run: `grep -o '① 看见' dist/index.html | head -1`
Expected: 输出一次。

- [ ] **Step 3: 提交**

```bash
git add docs/index.md
git commit -m "feat: build home page with hero and feature cards"
```

---

### Task 8: GitHub Pages 部署工作流

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: Task 1 的 npm scripts、Task 2 确认的 `dist/` 产物目录
- Produces: 推 `main` 自动构建并发布到 GitHub Pages

- [ ] **Step 1: 写工作流**

> **权限说明（别改回去）**：`actions/deploy-pages` 的官方 README 写明
> "The job that executes the deployment must at minimum have the following permissions:
> `pages: write` to deploy to Pages, `id-token: write` to verify the deployment originates
> from an appropriate source"。缺任何一个，deploy job 都会以
> "Resource not accessible by integration" 失败。
> `contents: read` 只够 checkout —— 我们不需要 `contents: write`（工作流不往仓库里提交东西）。
> `cancel-in-progress: false` 与 GitHub 官方 starter 工作流一致：让正在进行的部署跑完，
> 新的 push 排队而不是把它掐掉。
>
> **权限按 job 分开（不是工作流级）**：build job 会跑第三方 npm 代码（`npm ci`、`npm run build`），
> 所以它**不该**继承 `id-token: write`（能签发 OIDC token）—— 一旦依赖被投毒，
> 就能在构建阶段冒充本工作流。build job 只要 `contents: read`（checkout / npm ci / 构建）
> 加 `pages: read`（`configure-pages` 只调 `GET /repos/{owner}/{repo}/pages`；
> 只有开 `enablement: true` 时才会调 `POST`，而我们不开）。deploy job 要 `pages: write`
> + `id-token: write`。两个 job 都显式声明 ⇒ 顶层不再写 `permissions:`。
>
> **action 版本必须是 Node 24 大版本**：GitHub 已把 Node 20 从 Actions runner 移除
> （2026-09-23 公告），声明 `runs.using: node20` 的 action 只因被「强制跑在 Node 24」才没炸，
> 每次 run 都会打 Node.js 20 弃用警告 —— 那是**未承诺的兜底**，不是受支持的配置。
> 升版对本站是行为中性的：`checkout` v7 的破坏性变更只针对 `pull_request_target` /
> `workflow_run`（本工作流只有 `push` 到 `main` + `workflow_dispatch`）；
> `setup-node` v5+ 的自动缓存需要 `package.json` 有 `packageManager` 字段（本站没有）；
> `configure-pages` v6 / `deploy-pages` v5 只是把运行时换成 Node 24，输出不变。
> `upload-pages-artifact` v5 把内层 `actions/upload-artifact` 换成 v7 —— CI 警告里
> 出现的是**内层**的 `actions/upload-artifact@v4`，不是 `upload-pages-artifact` 本身。
> v4 起上传产物会**丢掉隐藏文件**，所以显式写 `include-hidden-files: true` 保持产物内容不变。

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: read
    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Setup Node
        uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Unit tests
        run: npm run test:unit

      - name: Build
        run: npm run build

      - name: Build output tests
        run: npm run test:build

      # Pages 站点必须先存在，否则这一步会以 404 "Get Pages site failed" 失败。
      # 开通方式：网页 Settings → Pages，或 gh api --method POST
      # repos/OWNER/REPO/pages -f build_type=workflow。不要在这里加 enablement: true ——
      # 它默认是 false，且需要 GITHUB_TOKEN 之外的 token（PAT，repo scope）才有权限。
      - name: Setup Pages
        uses: actions/configure-pages@v6

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v5
        with:
          path: dist
          include-hidden-files: true

  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 2: 校验 YAML 语法与权限结构**

Run: `python3 -c "import yaml,sys; d=yaml.safe_load(open('.github/workflows/deploy.yml')); print('jobs:', list(d['jobs'].keys())); print('build:', d['jobs']['build']['permissions']); print('deploy:', d['jobs']['deploy']['permissions'])"`
Expected: 输出 `jobs: ['build', 'deploy']`、`build: {'contents': 'read', 'pages': 'read'}`、
`deploy: {'pages': 'write', 'id-token': 'write'}`。

Run: `grep -nE "uses: actions/" .github/workflows/deploy.yml`
Expected: 五个 action **全部**是 Node 24 大版本 —— `checkout@v7` / `setup-node@v7` /
`configure-pages@v6` / `upload-pages-artifact@v5` / `deploy-pages@v5`。

> **PyYAML 的 `on:` 陷阱（别"修"它）**：用 `python3 -c "import yaml; ..."` 校验时，
> PyYAML 6.x 走 YAML 1.1 规范，会把顶层键 `on:` 解析成布尔 **`True`**
> （所以 `print(list(d.keys()))` 看到的是 `['name', True, 'concurrency', 'jobs']`）。
> 这是 **PyYAML 的老毛病，不是工作流写错了** —— GitHub Actions 自己的解析器把 `on` 当普通字符串键，
> 官方 starter 工作流就是这么写的。**不要**把它改成 `"on":` 或加引号。
> 校验只看 `jobs` 键即可（Step 2 的命令正是如此）。
>
> **顶层没有 `permissions:` 了**：权限改成按 job 声明（build = `contents: read` + `pages: read`，
> deploy = `pages: write` + `id-token: write`），所以 `d['permissions']` 会 KeyError ——
> 这是**预期的**，不要为了"修好"它而在顶层加回 `permissions:`。

- [ ] **Step 3: 确认产物目录与工作流一致**

Run: `grep -n "path: dist" .github/workflows/deploy.yml && ls -d dist`
Expected: 两处都显示 `dist`，且目录存在。

若 Task 2 Step 4 改用了 `outDir: '.vitepress/dist'`，则本步骤须把 `path: dist` 改为 `path: docs/.vitepress/dist`。

- [ ] **Step 4: 提交**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: deploy site to github pages on push"
```

- [ ] **Step 5: 首次部署需要作者手动操作**

> **实测更正（控制器在 Task 8 实现后核对过）**：原写「token 已失效，跑 `gh auth refresh -h github.com`」
> —— **这是错的**。实测：token **有效**（`gh api user` 返回 `shokosanma`），但 **scopes 里没有 `workflow`**：
> `admin:public_key, gist, read:org, repo`。而 `workflow` 恰恰是推 `.github/workflows/` 下文件所必需的
> （缺了会 403 "refusing to allow this token to update workflow files"）。
> 裸跑 `gh auth refresh` **默认保留原有 scopes、不会补上 `workflow`**，所以原来那条命令解决不了问题。
> 另有两条原先没写的前提：**本地没有配 git remote**，**GitHub 上还没有这个仓库**。下面是实测后的正确顺序。

1. **建仓库**（GitHub 上目前没有 `shokosanma/garbage-man`）：

   ```bash
   gh repo create shokosanma/garbage-man --public --description "从云账单和废品堆里，捡回被丢掉的钱"
   ```

   仓库名必须是 `garbage-man` —— 站点的 `base: '/garbage-man/'` 依赖它，名字对不上 Pages 路径就是错的。

2. **补 `workflow` scope —— 走 SSH 推送时可以跳过，走 API 合并时才必需**：

   本机已配好 GitHub SSH key（`ssh -T git@github.com` → `Hi shokosanma!`），
   而 GitHub 的 OAuth scope 检查**只作用于 API 和基于 token 的 git 操作**，
   「人通过 SSH 推送」不受 scope 限制 —— 所以第 4 步走 SSH 推 `.github/workflows/` **不会**被 403 拒。
   只有走 `gh pr create` + `gh pr merge`（API 合并）时才必须有 `workflow` scope：

   ```bash
   gh auth refresh -h github.com -s workflow
   ```

   Expected: 交互式授权成功；随后 `gh auth status` 的 scopes 里能看到 `workflow`。
   远程（不在机器旁）也能做：`gh auth refresh` 走 **OAuth 设备码流程**，
   命令会打印一次性验证码 + URL，在手机上打开 URL、输码、授权即可，命令随即在本机完成。

3. **配远端**（本地目前一个 remote 都没有）：

   ```bash
   git remote add origin git@github.com:shokosanma/garbage-man.git
   ```

4. **推 `main`**：工作流只在 push 到 `main` 时触发，只推特性分支不会部署；`workflow_dispatch` 可手动兜底。

5. **仓库页面开 Pages**：`Settings` → `Pages` → `Build and deployment` → `Source` 选 **GitHub Actions**。
   **Pages 站点必须先存在**，否则 `actions/configure-pages@v5` 的 "Setup Pages" 步骤会以 404 失败
   （`Get Pages site failed… consider exploring the enablement parameter`）—— 报错文案里的
   `enablement` 指的是「用这个参数去开 Pages」，不是「默认已经开了」。
   **不要在工作流里加 `enablement: true`**：它的默认值是 `false`，而且官方 action.yml 明确要求
   「a token other than `GITHUB_TOKEN`」（PAT 需 `repo` scope），工作流里的 `github.token` 没有那个权限，
   加了只会把「站点不存在」换成「权限不足」。
   纯命令行开站（无需 PAT，现有 token 的 `repo` scope 够用）：

   ```bash
   gh api --method POST repos/shokosanma/garbage-man/pages -f build_type=workflow
   ```

   幂等：站点已存在时再跑会报 422，但站点已经是开着的，不影响部署。

---

### Task 9: README 与写作指引

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: Task 3 的 `buildSidebar` 规则、Task 6 的 frontmatter 约定
- Produces: 作者写新文章时照抄的模板

- [ ] **Step 1: 写 `README.md`**

````markdown
# garbage-man

> 从云账单和废品堆里，捡回被丢掉的钱。

云上的闲置资源是垃圾，实体废品堆也是垃圾。这个仓库记录怎么把它们捡回来。

- **[云账单篇](docs/cloud/)** —— 阿里云 / 腾讯云 / 华为云的成本治理
- **[二手硬件篇](docs/hardware/)** —— 淘货账本与捡漏专题

线上地址：<https://shokosanma.github.io/garbage-man/>

## 本地开发

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 产物输出到仓库根 dist/
npm run preview    # 本地预览构建产物
npm test           # 单元测试 + 构建 + 产物断言
```

### 环境提示

本机 `HTTP_PROXY` 指向的代理端口已下线，项目内 `.npmrc` 已写 `noproxy=*` 绕过。
若 `npm install` 仍然挂起，改用：

```bash
env -u HTTP_PROXY -u HTTPS_PROXY npm install
```

`.npmrc` 里的 `noproxy=*` 只为绕开这台机器上的失效代理；
你若在需要代理的网络里装依赖，删掉这一行或改成自己的代理地址。

## 目录结构

```
garbage-man/             仓库根
├── docs/                站点内容（VitePress root）
│   ├── .vitepress/
│   │   ├── config.mts   站点配置
│   │   ├── sidebar.ts   侧边栏生成器：扫描目录树自动生成导航
│   │   └── theme/       主题与自定义组件
│   ├── public/images/   图片资源：文件放这里，Markdown 里写 /images/xxx.jpg
│   ├── index.md         首页
│   ├── cloud/           云账单篇
│   └── hardware/        二手硬件篇
├── specs/               设计文档与实施计划（不参与构建）
├── tests/               单元测试与产物断言
├── .github/workflows/   CI：推 main 自动构建并发布到 GitHub Pages
├── package.json         脚本与依赖
└── .npmrc               npm 配置（noproxy=*）
```

## 新增一篇文章

放进对应目录即可，**不需要改任何配置**。侧边栏由 `docs/.vitepress/sidebar.ts`
扫描目录树自动生成。

### 普通文章

```md
---
title: 阿里云账单标签成本分摊实战
description: 用标签把 ECS/OSS/RDS 的开销拆到团队和人
date: "2026-10-26"
cloud: 阿里云
tags: [成本分摊, 标签]
order: 1
---

# 阿里云账单标签成本分摊实战

正文。
```

### 硬件账本条目

```md
---
title: ThinkPad X1 Carbon Gen 9
description: 3200 元入手的 95 新轻薄本
date: "2026-10-26"
acquired: "2026-03-15"
price: 3200
condition: 95新
source: 闲鱼
verdict: 值          # 值 | 勉强 | 不值
specs:
  cpu: i7-1185G7
  ram: 16G
---

# ThinkPad X1 Carbon Gen 9

<LedgerCard />

![整机外观](/images/hardware/xxx.jpg)

## 到手实测
## 翻车点
## 值不值
```

### 云文章的步骤徽章

在 frontmatter 里写 `step: visibility` / `identify` / `dispose` / `prevent`，
正文按 `<StepBadge />` → 空行 → `# <title>` 的顺序开头，页面顶部会出现对应步骤的荧光徽章。

## frontmatter 里的日期要加引号

`date: "2026-10-26"`、`acquired: "2026-03-15"` —— 必须带引号。
不加引号时 YAML 会把它解析成 Date 对象，VitePress 注入页面数据时做了一次
`JSON.parse(JSON.stringify())`，Date 到客户端前已经变成 ISO 串。
账本页的「入手」现在靠 `LedgerCard` 里的 `asText()` 兜底，显示出来仍是 `2026-03-15`；
但那只是组件级的兜底 —— 任何直接插值的地方都会渲染成 `2026-03-15T00:00:00.000Z`。
加引号是唯一可靠的写法。

## 目录约定

- 每个内容目录需要一个 `index.md`，它决定该分组在侧边栏的标题与排序，
  缺 `index.md` 的目录不会出现在导航里。
- 侧边栏文字一律按 `sidebar_label` → `title` → 文件名 取，目录和单篇文章都一样；
  想给一篇文章换短标题，就给它加 `sidebar_label`。
- 排序用 frontmatter 的 `order` 字段（数字小的在前），**只在同一个目录内比较**；
  相同 order 时文件排在目录前；不写 `order` 视为 `999`，排在最后。
- 目录 URL 不带数字前缀，用语义命名（`cloud/visibility/` 而非 `cloud/10-visibility/`）。

## 写作规范

- **每个页面正文都要有一个 `# <title>`** —— VitePress 不会把 frontmatter 的 `title` 渲染成标题，
  不写就一个标题都看不见。首页例外：它是 `layout: home`，hero 自带 `<h1>`，正文不用再写。
  带 `<StepBadge />` 的页把徽章放在标题**上方**，带 `<LedgerCard />` 的页把卡片放在标题**下方**。
- **正文里的站内链接必须指向已存在的页面** —— VitePress 默认对死链报错，
  目标页没建好会直接让 `npm run build` 失败。
- **图片文件和引用必须同时存在** —— 引用 `/images/xxx.jpg` 就要把文件放进
  `docs/public/images/`，缺了构建会直接失败（实测：Rollup 解析不到这个资源）。
- **文章骨架**：引子 / 背景 → 问题 → 方案 → 可复现的命令与数据 → 踩过的坑 → 结论。
- **账本骨架**：关键参数表 / 入手价 / 渠道 / 时间（这一块由 `<LedgerCard />` 渲染，放在标题下方）
  → 图片 → 到手实测 → 翻车点 → 值不值。
- 命令可直接复制执行，标注运行平台与权限要求。
- 数据需标明来源与时间点 —— 云厂商价格与规则变动频繁。
- 不确定的内容标注「待核实」，不要凭记忆写厂商细节。

## 部署

推 `main` 分支触发 GitHub Actions 自动构建发布到 GitHub Pages。
Pages 站点必须**先存在**：仓库 `Settings` → `Pages` → `Source` 选 **GitHub Actions**，
或用命令行 `gh api --method POST repos/OWNER/REPO/pages -f build_type=workflow`。
站点不存在时，工作流的 "Setup Pages" 步骤会以 404 `Get Pages site failed` 失败。
````

- [ ] **Step 2: 验证 README 中的命令与实际一致**

Run: `node -e "const p=require('./package.json'); console.log(Object.keys(p.scripts).join(','))"`
Expected: `dev,build,preview,test:unit,test:build,test` —— 与 README 描述一致。

- [ ] **Step 3: 提交**

```bash
git add README.md
git commit -m "docs: add readme with authoring guidelines"
```

---

## 完成标准

全部任务完成后，以下命令必须全绿：

```bash
npm run test:unit   # 22 个单元测试通过
npm run build       # 构建成功，产物在 dist/
npm run test:build  # 5 个产物断言通过
```

且 `git status` 干净，`dist/`、`node_modules/` 未被提交。
