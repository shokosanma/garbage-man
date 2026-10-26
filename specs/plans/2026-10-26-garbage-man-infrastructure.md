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
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'public'])
const DEFAULT_ORDER = 999

function readFrontmatter(file: string): Frontmatter {
  if (!fs.existsSync(file)) return {}
  const { data } = matter(fs.readFileSync(file, 'utf8'))
  return data as Frontmatter
}

function toUrl(srcDir: string, absFile: string): string {
  const rel = path.relative(srcDir, absFile).split(path.sep).join('/')
  if (rel === 'index.md') return '/'
  if (rel.endsWith('/index.md')) return '/' + rel.slice(0, -'index.md'.length)
  return '/' + rel.replace(/\.md$/, '')
}

function buildLeaf(fileAbs: string, srcDir: string): OrderedItem {
  const fm = readFrontmatter(fileAbs)
  return {
    text: fm.title ?? path.basename(fileAbs, '.md'),
    link: toUrl(srcDir, fileAbs),
    _order: fm.order ?? DEFAULT_ORDER,
    _kind: 'file',
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
    _order: fm.order ?? DEFAULT_ORDER,
    _kind: 'dir',
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
  return a.text.localeCompare(b.text, 'zh-Hans-CN')
}

function strip(item: OrderedItem): SidebarItem {
  const { _order, _kind, ...rest } = item
  return rest
}

export function buildSidebar(srcDir: string): SidebarItem[] {
  const root = path.resolve(srcDir)
  if (!fs.existsSync(root)) {
    throw new Error(`[sidebar] 内容目录不存在: ${root}`)
  }
  const collected: OrderedItem[] = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
    const abs = path.join(root, entry.name)
    if (entry.isDirectory()) {
      const group = buildGroup(abs, root)
      if (group) collected.push(group)
    } else if (entry.name.endsWith('.md') && entry.name !== 'index.md') {
      collected.push(buildLeaf(abs, root))
    }
  }
  return collected.sort(compare).map(strip)
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

const CONTENT_ROOT = path.resolve(process.cwd(), 'docs')

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

`process.cwd()` 在 npm script 中恒为仓库根。若将来从别的目录调用 vitepress，构造器会抛「内容目录不存在」——这是有意的显式失败。

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
  --vp-c-divider: #30363d;
  --vp-c-text-1: #e6edf3;
  --vp-c-text-2: #9aa4b2;
  --vp-c-text-3: #6e7681;
  --vp-c-brand-1: #00e27a;
  --vp-c-brand-2: #00b862;
  --vp-c-brand-3: #00a354;
  --vp-c-brand-soft: rgba(0, 226, 122, 0.14);

  --gm-warn: #ffc400;
  --gm-danger: #ff6b6b;

  --vp-font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif;
  --vp-font-family-mono: ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, Consolas,
    'Liberation Mono', monospace;
}

@media (min-width: 640px) {
  :root {
    --vp-layout-max-width: 1440px;
  }
}

.dark {
  --vp-c-bg: #0d1117;
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

.ledger-card::before {
  content: '';
  position: absolute;
  left: 14px;
  top: 20px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--vp-c-bg);
  box-shadow:
    0 30px 0 var(--vp-c-bg),
    0 60px 0 var(--vp-c-bg),
    0 90px 0 var(--vp-c-bg),
    0 120px 0 var(--vp-c-bg),
    0 150px 0 var(--vp-c-bg),
    0 180px 0 var(--vp-c-bg),
    0 210px 0 var(--vp-c-bg),
    0 240px 0 var(--vp-c-bg);
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

.ledger-card__specs {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.ledger-card__specs th,
.ledger-card__specs td {
  padding: 0.35rem 0.6rem;
  border-top: 1px solid var(--vp-c-divider);
  text-align: left;
}

.ledger-card__specs th {
  width: 5.5rem;
  font-weight: 400;
  color: var(--vp-c-text-3);
}

.ledger-card__specs td {
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

**Interfaces:**
- Consumes: Task 3 的 `buildSidebar`（账本目录进侧边栏）、Task 4 的 `.ledger-card` 类名
- Produces: 全局组件 `LedgerCard`；`tests/build.test.mjs` 对 `dist/` 产物做断言

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
```

**注意（YAML 隐式类型陷阱）**：`date: 2026-03-15` 这类不带引号的日期，会被 gray-matter 的 YAML 引擎
（js-yaml `safeLoad`，DEFAULT_SCHEMA）解析成 **Date 对象**，不是字符串。
所以 frontmatter 里的日期一律**加引号**（`date: "2026-03-15"`），
组件里对 `acquired` 再用 `asText()` 兜一层 —— 防止作者漏加引号时把
`Sun Mar 15 2026 00:00:00 GMT+0000` 这种东西渲染到页面上。

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

const DIST = path.resolve(process.cwd(), 'dist')

function html(...segments) {
  return fs.readFileSync(path.join(DIST, ...segments), 'utf8')
}

function exists(...segments) {
  return fs.existsSync(path.join(DIST, ...segments))
}

test('首页已生成', () => {
  assert.ok(exists('index.html'))
})

test('资源链接带 base 前缀', () => {
  assert.match(html('index.html'), /\/garbage-man\/assets\//)
})

test('账本卡片渲染 frontmatter 字段', () => {
  const page = html('hardware', 'ledger', 'thinkpad-x1-carbon-gen9.html')
  assert.match(page, /¥3200/)
  assert.match(page, /is-good/)
  assert.match(page, /i7-1185G7/)
  assert.match(page, /95新/)
})

test('没有引入外链字体', () => {
  const cssDir = path.join(DIST, 'assets')
  const cssFile = fs.readdirSync(cssDir).find((f) => f.startsWith('style.') && f.endsWith('.css'))
  assert.ok(cssFile, '未找到编译后的样式文件')
  const css = fs.readFileSync(path.join(cssDir, cssFile), 'utf8')
  assert.doesNotMatch(css, /fonts\.googleapis|fonts\.gstatic/)
})
```

- [ ] **Step 5: 构建并运行集成测试**

Run: `npm run build && npm run test:build`
Expected: `pass 4 / fail 0`。

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
---

看不见的钱花不掉。这一步解决三个问题：

- 账单能不能拆到团队 / 项目 / 人
- 成本基线是什么，异常怎么被发现
- 预算告警挂在哪一层

<!-- 待填：目录页先给问题清单，具体厂商文章后续补 -->
```

其余三个同构，标题与 order 依次为：

| 文件 | title | order |
|---|---|---|
| `docs/cloud/identify/index.md` | ② 识别 · 找到垃圾 | 3 |
| `docs/cloud/dispose/index.md` | ③ 处置 · 删降换 | 4 |
| `docs/cloud/prevent/index.md` | ④ 防复发 · 机制 | 5 |

各目录的 `index.md` 正文暂列 2–3 条问题清单即可，标 `<!-- 待填 -->`。

- [ ] **Step 4: 写二手硬件篇骨架**

`docs/hardware/index.md`：

```md
---
title: 二手硬件篇
sidebar_label: 二手硬件
description: 从废品堆里捡回来的机器，和它们的真实价格
order: 2
---

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

<!-- 待填：专题目录 -->
```

- [ ] **Step 5: 构建并验证侧边栏结构**

Run: `npm run build`
Expected: 退出码 0。

Run: `node -e "const s=require('node:fs').readFileSync('dist/cloud/index.html','utf8'); for(const t of ['云账单篇','二手硬件','① 看见','② 识别','③ 处置','④ 防复发','淘货账本','硬件专题']) console.log(t, s.includes(t)?'OK':'MISSING')"`
Expected: 八项全部 `OK`。

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
Expected: `pass 4 / fail 0`。

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

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
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

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 校验 YAML 语法**

Run: `python3 -c "import yaml,sys; d=yaml.safe_load(open('.github/workflows/deploy.yml')); print('jobs:', list(d['jobs'].keys()))"`
Expected: 输出 `jobs: ['build', 'deploy']`。

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

在 GitHub 仓库页面：`Settings` → `Pages` → `Build and deployment` → `Source` 选 **GitHub Actions**。

作者还需要重新授权 gh CLI（token 已失效）：

Run: `gh auth refresh -h github.com`
Expected: 交互式授权成功；随后 `gh auth status` 显示已登录。

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

本机 `HTTP_PROXY` 指向的主机已下线，项目内 `.npmrc` 已写 `noproxy=*` 绕过。
若 `npm install` 仍然挂起，改用：

```bash
env -u HTTP_PROXY -u HTTPS_PROXY npm install
```

## 目录结构

```
docs/                    站点内容（VitePress root）
├── .vitepress/
│   ├── config.mts       站点配置
│   ├── sidebar.ts       侧边栏生成器：扫描目录树自动生成导航
│   └── theme/           主题与自定义组件
├── public/images/       图片资源
├── index.md             首页
├── cloud/               云账单篇
└── hardware/            二手硬件篇
specs/                   设计文档与实施计划（不参与构建）
tests/                   单元测试与产物断言
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

<LedgerCard />

## 到手实测
## 翻车点
## 值不值
```

### 云文章的步骤徽章

在 frontmatter 里写 `step: visibility` / `identify` / `dispose` / `prevent`，
正文首行加 `<StepBadge />`，页面顶部会出现对应步骤的荧光徽章。

## 目录约定

- 每个内容目录需要一个 `index.md`，它决定该分组在侧边栏的标题与排序，
  缺 `index.md` 的目录不会出现在导航里。
- 排序用 frontmatter 的 `order` 字段（数字小的在前）；相同 order 时文件排在目录前。
- 目录 URL 不带数字前缀，用语义命名（`cloud/visibility/` 而非 `cloud/10-visibility/`）。

## 写作规范

- **文章骨架**：引子 / 背景 → 问题 → 方案 → 可复现的命令与数据 → 踩过的坑 → 结论。
- **账本骨架**：图片 → 关键参数表 → 入手价 / 渠道 / 时间 → 到手实测 → 翻车点 → 值不值。
- 命令可直接复制执行，标注运行平台与权限要求。
- 数据需标明来源与时间点 —— 云厂商价格与规则变动频繁。
- 不确定的内容标注「待核实」，不要凭记忆写厂商细节。

## 部署

推 `main` 分支触发 GitHub Actions 自动构建发布到 GitHub Pages。
首次部署前需在仓库 `Settings` → `Pages` → `Source` 选择 **GitHub Actions**。
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
npm run test:unit   # 12 个单元测试通过
npm run build       # 构建成功，产物在 dist/
npm run test:build  # 4 个产物断言通过
```

且 `git status` 干净，`dist/`、`node_modules/` 未被提交。
