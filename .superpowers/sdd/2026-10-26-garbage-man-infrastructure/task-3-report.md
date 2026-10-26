# Task 3 报告：侧边栏生成器（TDD）

**状态：** DONE
**提交：** `55d3f76` feat: generate sidebar from content directory tree
**分支：** `feat/blog-site`

---

## 1. 实现内容

侧边栏导航由 `docs/` 目录树自动生成。新增一篇文章只需在内容目录里放一个 `.md` 文件，无需改动任何配置。

### 1.1 新增 `docs/.vitepress/sidebar.ts`

导出公开接口（后续任务依赖，签名未改动）：

```ts
export interface SidebarItem {
  text: string
  link?: string
  collapsed?: boolean
  items?: SidebarItem[]
}

export function buildSidebar(srcDir: string): SidebarItem[]
```

行为要点：

| 规则 | 实现位置 |
|---|---|
| 内容目录不存在 → 抛 `[sidebar] 内容目录不存在: <绝对路径>` | `buildSidebar()` |
| 顶层 `index.md` 不进入侧边栏 | `buildChildren()` 的 `entry.name !== 'index.md'` 判断（fix round 1 起顶层复用 `buildChildren()`，见文末 §7.1） |
| 含 `index.md` 的目录 → 分组项，链接 `/<dir>/` | `buildGroup()` + `toUrl()` |
| 缺少 `index.md` 的目录 → 整个目录被跳过（递归） | `buildGroup()` 返回 `null` |
| 标题优先级：`sidebar_label` > `title` > 文件/目录名 | `buildGroup()` / `buildLeaf()` —— **注意：fix round 1 之前叶子只认 `title`，本行原为错误表述，已由 `174bd9c` 更正** |
| 叶子链接去掉 `.md`：`/cloud/overview` | `toUrl()` |
| 排序：`order` 升序 → 同 order 时文件先于目录 → 再按标题 `localeCompare(zh-Hans-CN)` → 全同则按相对路径（fix round 1 新增） | `compare()` |
| 跳过 `node_modules` / `dist` / `public` 与所有 `.` 开头项 | `SKIP_DIRS` + `entry.name.startsWith('.')` |
| 内部排序辅助字段 `_order` / `_kind` / `_path` 在输出前剥离 | `strip()` |

### 1.2 新增 `tests/sidebar.test.ts`

12 个用例，全部照 brief 原样写入（未改动任何断言值）：目录缺失报错、空目录、顶层 index 排除、分组生成、无 index 目录跳过、`sidebar_label` 覆盖、叶子链接去 `.md`、嵌套二级分组、`order` 排序、文件优先于目录、标题排序、title 缺失回退文件名。

### 1.3 修改 `docs/.vitepress/config.mts`

```ts
import path from 'node:path'
import { buildSidebar } from './sidebar.ts'

const CONTENT_ROOT = path.resolve(process.cwd(), 'docs')
// ...
sidebar: buildSidebar(CONTENT_ROOT),
```

`./sidebar.ts` 保留 `.ts` 扩展名（VitePress 用 esbuild 打包 config，相对导入需精确路径），`gray-matter` 作为外部包在 `node_modules` 中真实解析。

---

## 2. TDD 证据

### 2.1 RED —— 先写测试，运行，确认失败

Step 1 写完 `tests/sidebar.test.ts` 后，**尚未创建 `docs/.vitepress/sidebar.ts`**，立即执行：

```
$ npm run test:unit
```

输出：

```
> garbage-man@0.1.0 test:unit
> node --test tests/sidebar.test.ts

node:internal/modules/esm/resolve:274
    throw new ERR_MODULE_NOT_FOUND(
          ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/shoko/code/garbage-man/docs/.vitepress/sidebar.ts' imported from /home/shoko/code/garbage-man/tests/sidebar.test.ts
    at finalizeResolution (node:internal/modules/esm/resolve:274:11)
    at moduleResolve (node:internal/modules/esm/resolve:864:10)
    at defaultResolve (node:internal/modules/esm/resolve:990:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:735:20)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:712:38)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:310:38)
    at #link (node:internal/modules/esm/module_job:208:49) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///home/shoko/code/garbage-man/docs/.vitepress/sidebar.ts'
}

Node.js v24.5.0
✖ tests/sidebar.test.ts (171.699041ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 190.026937

✖ failing tests:

test at tests/sidebar.test.ts:1:1
✖ tests/sidebar.test.ts (171.699041ms)
  'test failed'
```

退出码：`1`

**为什么这个失败是预期的：** brief 的 Step 2 明确要求此处失败。测试文件已经引用了尚未实现的 `../docs/.vitepress/sidebar.ts`，Node ESM 解析器在加载阶段就抛出 `ERR_MODULE_NOT_FOUND`，错误路径正是待实现的目标文件 `docs/.vitepress/sidebar.ts`。这证明测试确实依赖被测模块，失败原因是"实现不存在"而不是"断言不符"——正是 TDD 的 RED 阶段应有的失败模式。

### 2.2 GREEN —— 再写实现，运行，确认通过

Step 3 创建 `docs/.vitepress/sidebar.ts` 后执行同一命令：

```
$ npm run test:unit
```

输出：

```
> garbage-man@0.1.0 test:unit
> node --test tests/sidebar.test.ts

✔ 内容目录不存在时抛出明确错误 (3.016976ms)
✔ 空目录返回空数组 (1.798114ms)
✔ 顶层 index.md 不出现在侧边栏 (0.922156ms)
✔ 含 index.md 的目录成为分组，标题取自 frontmatter (7.521546ms)
✔ 缺 index.md 的目录被跳过 (1.287271ms)
✔ sidebar_label 覆盖 title (2.066237ms)
✔ 叶子条目链接为相对路径且去掉 .md (1.885524ms)
✔ 嵌套目录生成二级分组 (1.995009ms)
✔ order 决定排序，数字小的在前 (2.653937ms)
✔ order 相同时文件排在目录前 (5.63354ms)
✔ order 与 kind 都相同时按标题排序 (22.106639ms)
✔ 缺少 title 时回退到文件名 (1.407409ms)
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 344.956091
```

退出码：`0`，`pass 12 / fail 0`。输出干净，无多余警告（无 ExperimentalWarning、无未使用变量提示）。

### 2.3 与 brief 代码块的逐字比对

为确保"测试即规格"未被悄悄改动，写脚本从 brief 提取 3 个 ```ts 代码块与磁盘文件做全等比较：

```
ts blocks found: 3
tests/sidebar.test.ts EXACT MATCH
docs/.vitepress/sidebar.ts EXACT MATCH
docs/.vitepress/config.mts EXACT MATCH
```

三个文件与 brief 给定代码**逐字节一致**。

---

## 3. 后续步骤验证

### Step 5 —— 接入 config

`docs/.vitepress/config.mts` 的 `sidebar: []` 已替换为 `sidebar: buildSidebar(CONTENT_ROOT)`。

### Step 6 —— 构建验证

```
$ npm run build
> vitepress build docs

  vitepress v1.6.4
- building client + server bundles...
✓ building client + server bundles...
- rendering pages...
✓ rendering pages...
build complete in 5.86s.
```

退出码 `0`。此时 `docs/` 下还没有内容目录（`.vitepress/` 被 `.` 前缀规则跳过，根 `index.md` 被顶层规则排除），`sidebar` 为空数组，构建仍成功——与 brief 预期一致。

### 额外集成验证（临时探针，已清理）

为确认"config → 生成器 → 渲染产物"整条链路真的打通（而不只是构建不报错），临时在 `docs/` 下建了一个探针目录并构建，然后立即删除：

```
$ mkdir -p docs/__probe_group   # index.md(title=探针分组, sidebar_label=探针) + probe.md(title=探针文章)
$ npm run build
BUILD_EXIT=0
$ grep -o 'href="/garbage-man/__probe_group[^"]*"' dist/__probe_group/probe.html | sort -u
href="/garbage-man/__probe_group/"
href="/garbage-man/__probe_group/probe.html"
```

结论：生成器产出的链接被 VitePress 的 `normalizeLink()` 正确加上 `base`（`/garbage-man/`），叶子节点自动补 `.html` 后缀，分组节点保留尾斜杠并指向 `index.html`。探针目录与对应 `dist/` 产物已用 `fs.rmSync` 删除，随后重新构建并确认 `git status` 干净。

### Step 7 —— 提交

```
$ git add tests/sidebar.test.ts docs/.vitepress/sidebar.ts docs/.vitepress/config.mts
$ git commit -m "feat: generate sidebar from content directory tree"
[feat/blog-site 55d3f76] feat: generate sidebar from content directory tree
 3 files changed, 230 insertions(+), 1 deletion(-)
 create mode 100644 docs/.vitepress/sidebar.ts
 create mode 100644 tests/sidebar.test.ts
```

---

## 4. 改动的文件列表

| 文件 | 变更 | 行数 |
|---|---|---|
| `tests/sidebar.test.ts` | 新增 | +119 |
| `docs/.vitepress/sidebar.ts` | 新增 | +106 |
| `docs/.vitepress/config.mts` | 修改 | +5 / -1 |

未触碰 `docs/.vitepress/theme/index.ts`，未创建 `docs/cloud/`、`docs/hardware/`，未添加 CI workflow / README / 构建产物测试，工作树最终状态干净（`git status --porcelain` 无输出）。

---

## 5. 自查发现

1. **测试期望值未被改动** —— 脚本比对确认与 brief 逐字节一致，12 个用例的断言值全部原样保留。
2. **RED → GREEN 顺序真实** —— RED 运行发生在 `sidebar.ts` 文件存在之前，失败原因确为模块缺失。
3. **Node 类型剥离兼容性** —— 实现只用 `interface` / `type`，无 `enum` / `namespace` / 构造器参数属性；Node v24.5.0 正常剥离类型并执行，无警告。
4. **`.ts` 扩展名导入保留** —— 测试侧 `'../docs/.vitepress/sidebar.ts'`（Node ESM 精确路径要求）与 config 侧 `'./sidebar.ts'`（esbuild 打包）均按 brief 原样保留，未"修正"为无扩展名。
5. **CJS 依赖互操作** —— `import matter from 'gray-matter'` 在 Node ESM 与 VitePress esbuild 打包两条路径下均工作正常（构建实测通过）。
6. **ICU 可用性** —— `localeCompare(..., 'zh-Hans-CN')` 在本机 Node 上按拼音排序生效（'甲' < '乙' 用例通过），非退化实现。
7. **清理彻底** —— 探针目录与 `dist/` 探针产物均已删除并复建，`git status --untracked-files=all` 为空。

---

## 6. 问题与顾虑

1. **`npm test` 当前仍为红色（预期内，不属本任务范围）** —— `package.json` 的 `test` 脚本串联 `test:unit && npm run build && node --test tests/build.test.mjs`，而 `tests/build.test.mjs` 尚未创建（属于 Task 5）。实测输出 `Could not find 'tests/build.test.mjs'`，退出码 1。本任务的两个组成部分 `npm run test:unit`（12/12 通过）与 `npm run build`（退出码 0）均为绿色。Task 5 落地该文件后 `npm test` 即会整体转绿。

2. **`config.mts` 依赖 `process.cwd()`** —— `path.resolve(process.cwd(), 'docs')` 假定从仓库根调用 `vitepress`。若将来从其他目录运行（例如 `cd docs && npx vitepress build .`），构造器会抛「内容目录不存在」。这是 brief 明确设计的有意显式失败，不做额外处理，仅在此记录以免后续任务踩坑。

3. **分组链接尾斜杠语义** —— 分组项链接为 `/<dir>/`（对应 `index.html`），在静态托管上依赖目录索引解析（多数托管默认支持，VitePress 官方文档亦用此约定）。若未来部署到不做目录索引的托管，需要在部署层加 `cleanUrls` 或重写规则——属于 Task 5+ 的部署范畴，当前无需处理。

4. **`order` 仅读取自 `index.md`/叶子文件自身的 frontmatter** —— 分组的排序键取自其 `index.md` 的 `order`，符合 brief 的 Frontmatter 定义；跨层级的 order 不做继承，属于既定语义。

---

# 7. Fix round 1/5 — 评审修复

**状态：** DONE
**提交：** `174bd9c` fix: 消除侧边栏顶层扫描重复并修正标签、排序与内容根解析
**基线：** `55d3f76`（评审对象）

本轮处理评审提出的 1 个 Important（I1）与 7 个 Minor（M1–M7）。M1/M3/M6 按 TDD 顺序先写失败测试再改实现；I1、M2、M4、M5、M7 为纯实现改动。

## 7.0 改动的文件

| 文件 | 变更 |
|---|---|
| `docs/.vitepress/sidebar.ts` | I1、M1、M2、M3、M4 |
| `docs/.vitepress/config.mts` | M7 |
| `tests/sidebar.test.ts` | M5、M1/M2/M3/M4/M6 的测试 |

未触碰 `package.json`、`docs/.vitepress/theme/index.ts`，未新增 `docs/cloud/`、`docs/hardware/`。`toUrl()` 中 review 标注的 dead branch（`if (rel === 'index.md') return '/'`）按指示保留未动。

## 7.1 I1 — 顶层与嵌套层共用一套目录扫描（Important, plan-mandated）

**问题：** `buildSidebar()` 原先是 `buildChildren()` 的逐字复制，"点开头跳过 / `SKIP_DIRS` 跳过 / 目录须含 index.md / index.md 不作叶子" 四条规则存在两份实现，改一处会让顶层与嵌套层静默分叉。

**改法：** `buildSidebar()` 只保留 `existsSync` 守卫，扫描逻辑全部委托给 `buildChildren()`。

`docs/.vitepress/sidebar.ts:111-117`：

```ts
export function buildSidebar(srcDir: string): SidebarItem[] {
  const root = path.resolve(srcDir)
  if (!fs.existsSync(root)) {
    throw new Error(`[sidebar] 内容目录不存在: ${root}`)
  }
  return buildChildren(root, root)
}
```

唯一扫描实现现在位于 `docs/.vitepress/sidebar.ts:82-95`。新增测试「嵌套层级同样跳过点开头与保留目录」（`tests/sidebar.test.ts:191`）守住嵌套层行为，与既有的顶层测试（`tests/sidebar.test.ts:173`、`:180`）共同保证两层规则一致。

## 7.2 M1 — 叶子条目忽略 `sidebar_label`

**问题：** `buildGroup()` 用 `fm.sidebar_label ?? fm.title ?? basename`，`buildLeaf()` 只用 `fm.title ?? basename`。spec §4 中 `sidebar_label` 是逐内容页字段，作者在普通页面设置它会静默失效。原报告 §1.1 表格第 36 行把这条优先级链同时挂在 `buildGroup()`/`buildLeaf()` 名下，对叶子而言是错误表述——已在本次一并更正（见 §7.9）。

**改法：** `docs/.vitepress/sidebar.ts:59`，叶子与分组使用同一条优先级链：

```ts
text: fm.sidebar_label ?? fm.title ?? path.basename(fileAbs, '.md'),
```

**测试：** 「叶子条目的 sidebar_label 同样覆盖 title」（`tests/sidebar.test.ts:122`）。

## 7.3 M2 — 排序 tie-break 不稳定

**问题：** `order`、`_kind`、`text` 全等时 `compare()` 返回 0，最终顺序取决于 `fs.readdirSync` 的返回顺序（与文件系统实现相关），本地与 CI 可能生成不同的侧边栏。

**改法：** 给 `OrderedItem` 增加 `_path`（相对内容根的 posix 路径），作为最后一级 tie-break；与 `_order`/`_kind` 一样在输出前剥离。

- `docs/.vitepress/sidebar.ts:18-22`：`interface OrderedItem` 增加 `_path: string`
- `docs/.vitepress/sidebar.ts:45-47`：新增 `relPath()`，统一做 `path.relative(...).split(path.sep).join('/')`
- `docs/.vitepress/sidebar.ts:63` / `:78`：叶子与分组各自写入 `_path`
- `docs/.vitepress/sidebar.ts:97-104`：`compare()` 在标题相同时按 `_path` 兜底
- `docs/.vitepress/sidebar.ts:106-109`：`strip()` 一并剥离 `_path`

```ts
function compare(a: OrderedItem, b: OrderedItem): number {
  if (a._order !== b._order) return a._order - b._order
  if (a._kind !== b._kind) return a._kind === 'file' ? -1 : 1
  const byText = a.text.localeCompare(b.text, 'zh-Hans-CN')
  if (byText !== 0) return byText
  if (a._path === b._path) return 0
  return a._path < b._path ? -1 : 1
}
```

**测试：** 「相同内容、不同写入顺序产生完全一致的侧边栏」（`tests/sidebar.test.ts:203`）——同一组文件按两种写入顺序各建一份 fixture，断言两次输出完全相同，并断言并列项按路径排序（`['/a','/b','/c']`）。

> **关于这条测试在本机无法 RED 的说明：** 本机 `/tmp` 在 ext4 上，其 `readdir` 对短文件名返回的顺序恰好与字典序一致（实测 400 组随机文件名，`readdir` 顺序与字典序 0 例不符）。因此旧实现（tie 时沿用 `readdir` 顺序）在本机上恰好也能得到字典序，该测试在 fix 前即通过。M2 的缺陷只在 `readdir` 不按字典序返回的文件系统上显现。测试断言本身与文件系统无关，修复后行为确定，因此作为回归护栏保留；它无法在本机提供 RED 证据这一点如实记录在此。

## 7.4 M3 — `order` 被当作数字信任

**问题：** `fm.order ?? DEFAULT_ORDER` 在 `order` 是非数字字符串时得到字符串，比较器 `a._order - b._order` 得到 `NaN`；比较器返回 `NaN` 被当作 0（"相等"），排序结果变成任意的。

**改法：** 新增 `resolveOrder()`，非数字一律回退到 `DEFAULT_ORDER`。

`docs/.vitepress/sidebar.ts:39-43`：

```ts
function resolveOrder(order: unknown): number {
  if (order === undefined || order === null || order === '') return DEFAULT_ORDER
  const n = Number(order)
  return Number.isFinite(n) ? n : DEFAULT_ORDER
}
```

`buildLeaf()`（`:61`）与 `buildGroup()`（`:76`）都改用 `resolveOrder(fm.order)`。`undefined`/`null`/空串按"缺省"处理，其余按 `Number()` 判定，非有限数回退 999。

**测试：** 「order 为非数字时回退到默认值 999」（`tests/sidebar.test.ts:131`）——`a-high.md`（order 1000）与 `b-bad.md`（order `abc`），断言顺序为 `['坏值', '高位']`（999 < 1000）。文件名刻意让字典序与语义序相反，否则在按字典序返回 `readdir` 的文件系统上旧实现会侥幸通过。

## 7.5 M4 — frontmatter 解析报错不指出是哪个文件

**问题：** `matter()` 的 YAML 异常原样抛出，坏文件会让 `vitepress build` 挂掉却不说清是哪个文件。

**改法：** `docs/.vitepress/sidebar.ts:27-37` 包一层 try/catch，rethrow 成带路径的错误，并用 `cause` 保留原始异常：

```ts
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
```

**实现中发现并一并修掉的关联缺陷（gray-matter 内容缓存）：** gray-matter 在**解析之前**就把 `matter.cache[file.content] = file` 写进去了。若 YAML 解析抛错，缓存里留下的是半成品对象；同一份内容第二次解析会命中缓存、**静默返回空 frontmatter 且不再抛错**。实测：

```
opts=undefined call 1 -> threw: YAMLException
opts=undefined call 2 -> no throw, data= {}
opts={}        call 1 -> threw: YAMLException
opts={}        call 2 -> threw: YAMLException
```

后果有两个：同一坏文件第二次被扫描时错误信息消失（构建"看起来正常"）；两个内容完全相同的文件里，第二个会拿到空 frontmatter。传 `{}` 作为 options 即可绕开该缓存（gray-matter 仅在**没有** options 时才读写缓存），解析行为与默认值完全一致。

**测试：** 「frontmatter 解析失败时错误信息包含文件路径」（`tests/sidebar.test.ts:211`），断言错误消息同时匹配 `/frontmatter 解析失败/` 与 `/bad\.md/`。

## 7.6 M5 — 测试临时目录泄漏

**问题：** `fixture()` 每次调用 `fs.mkdtempSync` 但从不删除，每跑一次测试在 `$TMPDIR` 里留 12 个孤儿目录。

**改法：** `fixture()` 增加测试上下文参数，用 `t.after()` 注册清理。

`tests/sidebar.test.ts:8-20`：

```ts
interface TestScope {
  after(fn: () => void): void
}

function fixture(t: TestScope, files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-sidebar-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  ...
}
```

所有 11 处使用 `fixture()` 的用例改为 `fixture(t, ...)`。项目未安装 `@types/node`，因此 `TestScope` 用结构化类型声明，避免引用无法解析的类型。

## 7.7 M6 — 未覆盖的代码路径

补齐 6 条测试（`tests/sidebar.test.ts`）：

| 测试 | 覆盖的路径 |
|---|---|
| 「order 缺失时按默认值 999 排序」`:141` | `DEFAULT_ORDER`（`sidebar.ts:25`） |
| 「分组项的 collapsed 为 false」`:151` | `collapsed: false`（`sidebar.ts:74`） |
| 「点开头的条目不会进入侧边栏」`:156` | `entry.name.startsWith('.')`（`sidebar.ts:85`） |
| 「node_modules/dist/public 目录不会进入侧边栏」`:164` | `SKIP_DIRS`（`sidebar.ts:24`、`:85`） |
| 「.vitepress 目录不会变成侧边栏条目」`:172` | 「侧边栏只从内容树生成」的具体形式：`docs/.vitepress` 永远不成为条目 |
| 「嵌套层级同样跳过点开头与保留目录」`:181` | 嵌套层与顶层走同一套跳过规则（I1 的护栏） |

其中「`.vitepress` 不会成为条目」与「嵌套层级同样跳过」两条守住的是承重行为。

## 7.8 M7 — `process.cwd()` 把内容根耦合到调用目录

**问题：** `path.resolve(process.cwd(), 'docs')` 在任何"恰好也有 `docs/` 目录"的父目录里运行 `vitepress build docs`，都会用**错误的目录树**生成侧边栏，而且不报任何错（静默失败，比抛错更糟）。

**改法：** `docs/.vitepress/config.mts:5` 改为按配置文件自身位置推导：

```ts
// 以配置文件自身位置推导内容根，与调用方的 cwd 无关。
const CONTENT_ROOT = path.resolve(import.meta.dirname, '..')
```

机制与控制器 spike 一致：Vite 的 `bundleConfigFile` 在 esbuild 中以 `define` 把 `import.meta.dirname` 替换为 `__vite_injected_original_dirname`，而该变量由 `inject-file-scope-variables` 插件设为 `path.dirname(源配置文件路径)`（`node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:66842`、`:66860`、`:66943-66949`），即 `<repo>/docs/.vitepress`；`resolve(..., '..')` 得到 `<repo>/docs`。项目 `engines.node` 为 `>=22.18.0`，满足 `import.meta.dirname` 所需的 Node ≥ 20.11。

**实测验证（前后对照）：** 构造诱饵目录 `/tmp/decoy-project/docs/decoy/index.md`（标题「错误目录的分组」），在本仓库放临时探针目录 `docs/__probe_group/`，然后**在诱饵目录下**执行 `vitepress build <repo>/docs`：

```
旧实现（process.cwd()）:
BUILD_EXIT=0
OLD behavior: decoy title in built output? (expect >0 = silent wrong tree)
+1
OLD behavior: our repo content present? (expect 0)
+0

新实现（import.meta.dirname）:
BUILD_EXIT=0
FIXED: decoy title (expect 0)
+0
FIXED: our repo content (expect >0)
+1
```

旧实现构建退出码 0、无任何报错，侧边栏却来自诱饵目录（"错误目录的分组"在产物中、本仓库的"探针"完全不在）；新实现则稳定地使用本仓库的内容树。

**其余构建校验：** `npm run build` 退出码 0；`dist/` 仍落在仓库根（`outDir: '../dist'` 相对 docs 目录解析，与 cwd 无关）；base 前缀 `/garbage-man/` 正常；`docs/.vitepress/` 下**没有残留** `config.mts.timestamp-*.mjs`（Vite 加载配置后自行删除），`git status` 中也不存在该文件。验证用的诱饵目录与探针目录均已删除并重建。

## 7.9 对原报告的更正

原 §1.1 表格第 36 行写「标题优先级：`sidebar_label` > `title` > 文件/目录名 | `buildGroup()` / `buildLeaf()`」，并把它当成对两者都成立的规则——**对叶子是错的**，叶子当时只认 `title`。该行已更正并标注 fix round 1 的修订；同时更正了同一表格中因 I1 失效的行（第 33 行「顶层 index.md 判断」的位置、第 38 行的排序规则、第 40 行的内部字段列表）。原 §6.2「config.mts 依赖 process.cwd()」的顾虑已由 M7 消除（见 §7.8）。

## 7.10 TDD 证据

### RED —— 先写新测试并运行（实现未改）

命令：`npm run test:unit`

```
> garbage-man@0.1.0 test:unit
> node --test tests/sidebar.test.ts

✔ 内容目录不存在时抛出明确错误 (3.144158ms)
✔ 空目录返回空数组 (3.416153ms)
✔ 顶层 index.md 不出现在侧边栏 (1.712946ms)
✔ 含 index.md 的目录成为分组，标题取自 frontmatter (8.175499ms)
✔ 缺 index.md 的目录被跳过 (2.273986ms)
✔ sidebar_label 覆盖 title (2.791977ms)
✔ 叶子条目链接为相对路径且去掉 .md (2.781793ms)
✔ 嵌套目录生成二级分组 (2.557722ms)
✔ order 决定排序，数字小的在前 (3.529539ms)
✔ order 相同时文件排在目录前 (2.929208ms)
✔ order 与 kind 都相同时按标题排序 (21.869758ms)
✔ 缺少 title 时回退到文件名 (1.784441ms)
✖ 叶子条目的 sidebar_label 同样覆盖 title (3.481854ms)
✖ order 为非数字时回退到默认值 999 (2.741861ms)
✔ order 缺失时按默认值 999 排序 (1.350113ms)
✔ 分组项的 collapsed 为 false (1.019096ms)
✔ 点开头的条目不会进入侧边栏 (1.596976ms)
✔ node_modules/dist/public 目录不会进入侧边栏 (1.962899ms)
✔ .vitepress 目录不会变成侧边栏条目 (1.755569ms)
✔ 嵌套层级同样跳过点开头与保留目录 (1.971713ms)
✔ 相同内容、不同写入顺序产生完全一致的侧边栏 (2.491912ms)
✖ frontmatter 解析失败时错误信息包含文件路径 (2.46402ms)
ℹ tests 22
ℹ suites 0
ℹ pass 19
ℹ fail 3
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 384.202614ms
```

退出码 `1`。**为什么这 3 个失败是预期的：** 三条失败分别对应 M1（叶子忽略 `sidebar_label`）、M3（非数字 `order` 产生 `NaN` 比较导致顺序错乱）、M4（YAML 异常原样抛出、消息里没有文件路径）。失败的断言值本身就是修复后的期望值，实现一改即转绿。其余 19 条通过，说明新增用例没有误伤既有行为。

### GREEN —— 实现修复后运行

命令：`npm run test:unit`

```
> garbage-man@0.1.0 test:unit
> node --test tests/sidebar.test.ts

✔ 内容目录不存在时抛出明确错误 (3.152388ms)
✔ 空目录返回空数组 (3.310413ms)
✔ 顶层 index.md 不出现在侧边栏 (1.712946ms)
✔ 含 index.md 的目录成为分组，标题取自 frontmatter (8.215833ms)
✔ 缺 index.md 的目录被跳过 (2.821155ms)
✔ sidebar_label 覆盖 title (2.268923ms)
✔ 叶子条目链接为相对路径且去掉 .md (2.796794ms)
✔ 嵌套目录生成二级分组 (2.540152ms)
✔ order 决定排序，数字小的在前 (3.651482ms)
✔ order 相同时文件排在目录前 (2.929373ms)
✔ order 与 kind 都相同时按标题排序 (20.287243ms)
✔ 缺少 title 时回退到文件名 (1.785098ms)
✔ 叶子条目的 sidebar_label 同样覆盖 title (1.624884ms)
✔ order 为非数字时回退到默认值 999 (1.775954ms)
✔ order 缺失时按默认值 999 排序 (1.495176ms)
✔ 分组项的 collapsed 为 false (1.133013ms)
✔ 点开头的条目不会进入侧边栏 (1.822061ms)
✔ node_modules/dist/public 目录不会进入侧边栏 (2.163576ms)
✔ .vitepress 目录不会变成侧边栏条目 (1.965764ms)
✔ 嵌套层级同样跳过点开头与保留目录 (2.046174ms)
✔ 相同内容、不同写入顺序产生完全一致的侧边栏 (4.941713ms)
✔ frontmatter 解析失败时错误信息包含文件路径 (3.634509ms)
ℹ tests 22
ℹ suites 0
ℹ pass 22
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 375.973706ms
```

退出码 `0`，`pass 22 / fail 0`，输出干净无警告。

### 构建验证

命令：`npm run build`

```
> garbage-man@0.1.0 build
> vitepress build docs

  vitepress v1.6.4

- building client + server bundles...
✓ building client + server bundles...
- rendering pages...
✓ rendering pages...
build complete in 5.91s.
```

退出码 `0`。

## 7.11 本轮遗留与说明

1. **`npm test` 仍为红色（预期内）** —— `npm test` 串联 `test:unit && npm run build && node --test tests/build.test.mjs`，`tests/build.test.mjs` 属 Task 5，尚未创建。本任务的 `npm run test:unit`（22/22）与 `npm run build`（退出码 0）均为绿色。
2. **M2 的测试在本机无法 RED** —— 原因见 §7.3 的说明（本机 ext4 的 `readdir` 恰好按字典序返回）。测试断言与文件系统无关，作为回归护栏保留。
3. **`specs/plans/2026-10-26-garbage-man-infrastructure.md` 的工作区改动未提交** —— 该文件在本轮工作期间被控制器修改（`vitepress/theme-without-fonts` 同步、`docs/cloud/overview.md` 补 `order: 1`，即 review 提到的 Minor 10）。它不属于本任务的三个文件，我未改动也未提交，原样留在工作区交由控制器处理。
4. **review 标注的 dead branch 未动** —— `toUrl()` 中 `if (rel === 'index.md') return '/'` 按指示保留。
5. **gray-matter 缓存绕过是本轮新增的实现约束** —— 后续若有人把 `matter(content, {})` 改回 `matter(content)`，坏 frontmatter 的报错会重新变成"只报第一次"，请勿"顺手清理"这个空对象参数（代码里已留注释说明）。
