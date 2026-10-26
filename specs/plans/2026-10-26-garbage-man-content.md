# garbage-man 首批内容 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 填充博客的首批内容 —— 云账单篇「四步法」完整框架下的 13 篇厂商实操文章、硬件篇 4 篇专题、2 篇账本模板，并配一套自动化链接校验，让每篇文章的内部引用不悬空。

**Architecture:** 内容全部是 `docs/` 下的 Markdown，靠 frontmatter 与目录树接入导航，无需改配置。质量靠两层保障：一是「厂商细节必须联网核实后再落笔」的写作纪律（核实不实的标 `待核实`）；二是 `tests/links.test.mjs` 对构建产物做内部链接可达性断言，把悬空链接挡在 CI 之外。

**Tech Stack:** Markdown / VitePress frontmatter / node:test 产物断言 / web_search + web_fetch 核实

**Spec:** `specs/2026-10-26-garbage-man-blog-design.md`（第 6 节内容规划、第 10 节写作规范）

**前置条件:** `specs/plans/2026-10-26-garbage-man-infrastructure.md` 已完成，站点可构建、侧边栏可生成。

## Global Constraints

- 语言：简体中文。面向工程师，句子短，不写营销腔。
- **厂商细节必须联网核实后再写**：控制台路径、指标名、配额、计费规则、价格、有效期，全部以官方文档为准。核实不到的一律标 `<!-- 待核实 -->`，绝不用记忆凑数。
- 每篇涉及价格、比例、限制值的内容，正文末尾或就近处标注核实时间（格式：`> 核实时间：2026-10-26`）。
- 每篇文章 frontmatter 必填 `title` / `description` / `date`；云文章加 `cloud`（`阿里云` / `腾讯云` / `华为云`）与 `step`；`tags` 用中文短词。
- 文章骨架固定：引子 / 背景 → 问题 → 方案 → 可复现的命令与数据 → 踩过的坑 → 结论。
- 命令必须标注运行平台、所需权限（如 `ecs:DescribeInstances` 这类只读 / 写权限）。
- 硬件文章不得出现具体品牌未公开的内部数据；价格以「行情区间」表述并标注时间点。
- 云文章正文首行加 `<StepBadge />`（`step` 字段驱动），硬件文章不加。
- 内部链接一律用站点绝对路径（`/cloud/visibility/xxx`），不写相对路径。
- 每完成一篇跑一次 `npm run build && npm run test:build`，链接测试保持绿。

---

### Task 1: 内部链接可达性测试

**Files:**
- Create: `tests/links.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 2 起的全部内容产出的 `dist/` HTML
- Produces: `npm run test:links` 脚本；对 `dist/**/*.html` 中所有 `/garbage-man/` 开头的内部链接做可达性断言

- [ ] **Step 1: 写 `tests/links.test.mjs`**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const DIST = path.resolve(process.cwd(), 'dist')
const BASE = '/garbage-man/'

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(abs))
    else if (entry.name.endsWith('.html')) out.push(abs)
  }
  return out
}

function internalLinks(html) {
  const matches = html.match(/href="[^"]*"/g) ?? []
  return matches
    .map((m) => m.slice(6, -1))
    .filter((href) => href.startsWith(BASE))
    .map((href) => href.split('#')[0])
    .filter(Boolean)
}

test('dist 中存在至少一个页面', () => {
  assert.ok(fs.existsSync(DIST), 'dist 不存在，请先运行 npm run build')
  assert.ok(walk(DIST).length > 0)
})

test('所有内部链接均可达', () => {
  const broken = []
  for (const file of walk(DIST)) {
    const html = fs.readFileSync(file, 'utf8')
    for (const href of internalLinks(html)) {
      const rel = href.slice(BASE.length)
      const target = path.join(DIST, rel)
      const candidates = [
        target,
        path.join(target, 'index.html'),
        `${target}.html`,
      ]
      if (!candidates.some((c) => fs.existsSync(c))) {
        broken.push(`${path.relative(DIST, file)} -> ${href}`)
      }
    }
  }
  assert.deepEqual(broken, [], `存在悬空内部链接:\n${broken.join('\n')}`)
})

test('页面数量与内容目录规模相称', () => {
  const pages = walk(DIST).filter((f) => !f.endsWith('404.html'))
  assert.ok(pages.length >= 15, `页面过少：${pages.length}，内容可能没写完`)
})
```

- [ ] **Step 2: 加 npm script**

改 `package.json` 的 `scripts`：

```json
    "test:links": "node --test tests/links.test.mjs",
    "test": "npm run test:unit && npm run build && npm run test:build && npm run test:links"
```

- [ ] **Step 3: 先让页面数量断言失败一次**

Run: `npm run build && npm run test:links`
Expected: FAIL，`页面过少` 报错（当前页面数 < 15）。这是预期结果 —— Task 8 补齐内容后转绿。

此阶段提交红测试不影响 CI：基础设施计划的 workflow 逐步执行 `test:unit` / `build` / `test:build`，不含 `test:links`。链接断言在 Task 9 Step 5 才接入 workflow。

- [ ] **Step 4: 提交（允许此时测试红）**

```bash
git add tests/links.test.mjs package.json
git commit -m "test: add internal link reachability check"
```

---

### Task 2: 四步法总纲

**Files:**
- Modify: `docs/cloud/overview.md`

**Interfaces:**
- Consumes: 无
- Produces: 全站的云成本方法论主干文章，其他云文章都回链到它

- [ ] **Step 1: 确认文章定位**

这是全站**唯一不依赖厂商细节**的云文章，读者从任何一篇具体文章进来都可能被引导到它。它定义四个步骤的边界、各自的产出物、以及常见误区。

- [ ] **Step 2: 写正文**

替换 `docs/cloud/overview.md` 的 `<!-- 待填 -->`：

````md
---
title: 四步法总纲
description: 云账单降本的通用框架：看见、识别、处置、防复发
date: 2026-10-26
tags: [方法论, 成本治理]
---

# 四步法总纲

云账单上多出来的钱，通常不是被某一次决策花掉的，而是**没人看的资源慢慢堆积**的结果。
这个博客记录的四步法，就是把「看不见的浪费」一步步变成「看得见、能处置、不再复发」的东西。

## 第 0 步之前：先有账单

没有账单就没有降本。可用的账单来源至少要能回答三个问题：

- 花了多少钱 —— 总额与趋势
- 花在谁身上 —— 团队 / 项目 / 环境
- 花在什么上 —— 产品 / 服务 / 资源类型

大多数团队卡在第二步：账单只有一张总表，谁花的钱说不清，于是没人认领也没人负责。

## ① 看见 · 成本可见性

把总账单拆开，直到能定位到「谁」在花「什么」的钱。

常见手段：账号 / 项目层级隔离、资源标签、账单分摊规则、预算与异常告警。

**产出物**：一张能看到归属的成本表，加上告警阈值。

**常见误区**：一上来就追求颗粒度。先拆到「团队」这一层就够用，颗粒度太细维护成本会反噬。

## ② 识别 · 找到垃圾

在可见性基础上，把「本不该存在的开销」找出来。典型形态：

| 类型 | 典型形态 |
|---|---|
| 空转的计算 | 长期低利用率的实例、只跑定时任务的常驻机器 |
| 孤儿资源 | 未挂载的云盘、未引用的公网 IP、空的负载均衡 |
| 堆积的存储 | 无人清理的快照与镜像、没设生命周期的对象存储 |
| 错配的计费 | 稳定负载用按量付费、预留实例闲置、超配的带宽 |
| 隐形的流量 | 跨地域传输、跨可用区互通、回源流量 |

**产出物**：一份带估价的垃圾清单，按「省下多少」排序。

**常见误区**：只看资源清单不看账单金额。先按费用倒序排，再决定要不要动。

## ③ 处置 · 删、降、换

对清单上的每一项，只有三种动作：

- **删** —— 确认无引用后直接释放。删之前先确认快照、备份、依赖关系。
- **降** —— 降配、缩容、缩短保留期、降低存储层级。
- **换** —— 换计费形态（按量 → 包年包月 / 预留 / 节省计划），换实例类型，换可用区。

**产出物**：一张处置记录表 —— 动了什么、省了多少、有什么风险。

**常见误区**：忽略动作的可逆性。能回滚的先小批量试，不可逆的（删数据、改计费）留出观察期。

## ④ 防复发 · 机制

降本是持续运动，不是一次性工程。第四步决定前面三步的效果能维持多久。

- **规范**：资源标签有 owner、有生命周期责任人；新资源不带标签不许上线。
- **自动化**：定期扫描空转资源并通知；快照与日志的生命周期策略。
- **告警**：预算超支、异常增长、闲置资源产生，都在发生当周就被看到。
- **准入**：新服务上线前先算一遍成本预估，评审通过再开资源。

**产出物**：一套能自动跑、不依赖人记得做的规则。

## 怎么用这个仓库

四个步骤各有独立目录，厂商差异大的部分拆成单独文章：

- [① 看见 · 成本可见性](/cloud/visibility/)
- [② 识别 · 找到垃圾](/cloud/identify/)
- [③ 处置 · 删降换](/cloud/dispose/)
- [④ 防复发 · 机制](/cloud/prevent/)

厂商特有能力会注明厂商名；跨厂商通用的思路只在这里写一次。
````

- [ ] **Step 3: 验证并提交**

Run: `npm run build`
Expected: 退出码 0。

```bash
git add docs/cloud/overview.md
git commit -m "docs: write the four-step cloud cost methodology"
```

---

### Task 3: ① 看见 —— 成本可见性

**Files:**
- Create: `docs/cloud/visibility/aliyun-tag-cost.md`
- Create: `docs/cloud/visibility/tencent-project-cost.md`
- Create: `docs/cloud/visibility/huawei-eps-cost.md`
- Modify: `docs/cloud/visibility/index.md`

**Interfaces:**
- Consumes: `StepBadge` 组件（`step: visibility`）
- Produces: 三篇厂商成本归集文章，每篇回链 `/cloud/overview/`

- [ ] **Step 1: 核实阿里云标签计费的当前机制**

用 `web_search` / `web_fetch` 查阿里云官方文档（help.aliyun.com），核实以下各项，**逐条记录结论**：

- 费用中心账单中按标签筛选 / 分摊的具体入口路径
- 标签的 key/value 数量上限、单字符长度限制
- 支持计费标签的资源类型范围（ECS / RDS / OSS / SLB 是否全覆盖）
- 分摊规则类型（按比例 / 按用量）及优先级
- 未打标签的资源在账单中如何呈现

搜索关键词参考：`阿里云 费用中心 标签 分摊 账单`、`阿里云 ECS 标签 计费 限制`。

若某项查不到官方依据，正文写「以控制台实际显示为准」并标 `<!-- 待核实 -->`。

- [ ] **Step 2: 写 `docs/cloud/visibility/aliyun-tag-cost.md`**

frontmatter：

```yaml
---
title: 阿里云用标签做成本分摊
description: 把 ECS、OSS、RDS 的开销拆到团队和项目头上
date: 2026-10-26
cloud: 阿里云
step: visibility
tags: [标签, 成本分摊, 账单]
---
```

章节骨架：

```md
<StepBadge />

# 阿里云用标签做成本分摊

<!-- 引子：为什么账单拆不到团队就没人负责 -->

## 前提：给资源打上能追溯的标签

## 在费用中心按标签看账

## 分摊规则：按比例还是按用量

## 支持计费标签的资源类型

## 踩过的坑

## 结论

> 核实时间：2026-10-26
```

写作要求：入口路径写成可点击路径（如「费用中心 → 账单 → 标签」）；限制值写成具体数字；坑的部分写真实会踩到的（比如标签在创建时才能打、后续改标签会影响历史账单归属 —— 以核实结果为准）。

- [ ] **Step 3: 核实并写腾讯云与华为云两篇**

腾讯云核实要点：

- 项目（Project）/ 子账号（子账号 CAM 关联）与账单的关系
- 账单下载是否支持按项目 / 实例拆分
- 共享成本（公网流量、带宽等）的分摊方式

华为云核实要点：

- 企业项目（Enterprise Project）的资源归属与账单视图
- 企业项目与资源中心的绑定方式
- 账单导出中按企业项目拆分的可行性

搜索关键词参考：`腾讯云 账单 项目 成本 拆分`、`腾讯云 子账号 账单`、`华为云 企业项目 资源 归属 账单`。

frontmatter 对应 `cloud: 腾讯云` / `cloud: 华为云`，`step: visibility`，章节骨架与阿里云一致。

- [ ] **Step 4: 完善目录页**

改 `docs/cloud/visibility/index.md`，把「待填」换成文章列表：

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

## 厂商实践

- [阿里云用标签做成本分摊](/cloud/visibility/aliyun-tag-cost)
- [腾讯云按项目归集成本](/cloud/visibility/tencent-project-cost)
- [华为云用企业项目归集成本](/cloud/visibility/huawei-eps-cost)

通用框架见 [四步法总纲](/cloud/overview/)。
```

- [ ] **Step 5: 构建、验证、提交**

Run: `npm run build && npm run test:links`
Expected: 链接测试中「所有内部链接均可达」通过（页面数量断言此时仍会红，属预期）。

```bash
git add docs/cloud/visibility
git commit -m "docs: add cost visibility articles for aliyun tencent huawei"
```

---

### Task 4: ② 识别 —— 找到垃圾

**Files:**
- Create: `docs/cloud/identify/idle-compute.md`
- Create: `docs/cloud/identify/orphan-resources.md`
- Create: `docs/cloud/identify/storage-lifecycle.md`
- Create: `docs/cloud/identify/network-traffic.md`
- Modify: `docs/cloud/identify/index.md`

**Interfaces:**
- Consumes: `StepBadge`（`step: identify`）
- Produces: 四篇跨厂商的识别实操，命令与指标名按厂商分节写

- [ ] **Step 1: 核实三家云的空闲判定口径**

对阿里云、腾讯云、华为云分别核实：

- 云监控中 CPU / 内存 / 网络利用率的**指标名**与统计粒度（分钟 / 小时）
- 是否有官方的「闲置实例」识别功能或成本分析工具（如费用中心的实例 ID 筛选、闲置资源助手）
- 空闲判定的官方建议阈值（如 CPU 连续 N 天低于 X%）

搜索关键词参考：`阿里云 云监控 CPU 利用率 指标`、`腾讯云 云监控 指标名 CPU`、`华为云 空闲 ECS 识别 费用中心`。

**写作要求**：跨厂商通用的判定逻辑写一次；指标名与控制台路径按厂商分小节。命令示例用各家的 CLI（aliyun / tccli / huaweicloud），并注明所需只读权限。

- [ ] **Step 2: 写 `docs/cloud/identify/idle-compute.md`**

frontmatter：

```yaml
---
title: 识别空跑的计算资源
description: 用监控指标把长期低利用率的实例挑出来
date: 2026-10-26
step: identify
tags: [闲置资源, 监控, 降本]
---
```

章节骨架：

```md
<StepBadge />

# 识别空跑的计算资源

## 空跑的两种形态：一直闲着 与 只在特定时段用

## 判定口径：窗口、粒度、阈值

## 阿里云

### 指标与查询
### CLI 示例

## 腾讯云

### 指标与查询
### CLI 示例

## 华为云

### 指标与查询
### CLI 示例

## 踩过的坑

## 结论
```

每家的 CLI 示例写成完整可复制的形式（查询 → 过滤 → 输出），并在代码块上方注明所需权限与地域参数。

- [ ] **Step 3: 写 `docs/cloud/identify/orphan-resources.md`**

核实要点（跨厂商通用结论 + 各家差异）：

- 未挂载云盘：官方是否提供「未挂载磁盘」的识别入口（阿里云 ECS 控制台的「未挂载的云盘」筛选）
- 未引用的弹性公网 IP / EIP：释放规则与占用费
- 空负载均衡 / 负载均衡未绑后端
- NAT 网关 / 弹性网卡的闲置
- 快照与自定义镜像的堆积

章节骨架：

```md
<StepBadge />

# 识别孤儿资源

## 为什么孤儿资源比闲置实例更隐蔽

## 未挂载的云盘

## 未引用的公网 IP

## 空负载均衡与闲置网络组件

## 堆积的快照与镜像

## 踩过的坑

## 结论
```

- [ ] **Step 4: 写 `docs/cloud/identify/storage-lifecycle.md`**

核实要点：

- 对象存储的生命周期规则配置入口与语法（阿里云 OSS / 腾讯云 COS / 华为云 OBS 的策略类型差异）
- 存储层级（标准 / 低频 / 归档 / 归档）各自的价格与取回费用
- 最小存储时长与不足时长的计费方式
- 日志与监控数据的留存成本

章节骨架：

```md
<StepBadge />

# 存储生命周期：让冷数据自己变便宜

## 三种常见错误

## 生命周期规则怎么写

## 存储层级怎么选

## 保留时长不足的隐性成本

## 踩过的坑

## 结论
```

- [ ] **Step 5: 写 `docs/cloud/identify/network-traffic.md`**

核实要点：

- 跨地域传输费用的计价方向与单价
- 跨可用区（跨 AZ）互通的费用
- 公网出网流量计费模式（按固定带宽 / 按用量）及各自的适用场景
- CDN 回源流量与 CDN 流量费的差别

章节骨架：

```md
<StepBadge />

# 识别网络流量里的隐形成本

## 四类容易被忽略的流量账

## 跨地域传输

## 跨可用区互通

## 公网出网

## CDN 回源

## 踩过的坑

## 结论
```

- [ ] **Step 6: 完善目录页**

改 `docs/cloud/identify/index.md`：

```md
---
title: ② 识别 · 找到垃圾
description: 空跑实例、孤儿资源、存储堆积、流量隐形成本
order: 3
---

账单里最贵的通常不是「用得多」，而是「本不该存在」。这一章把常见的浪费形态逐个拆开。

- [识别空跑的计算资源](/cloud/identify/idle-compute)
- [识别孤儿资源](/cloud/identify/orphan-resources)
- [存储生命周期：让冷数据自己变便宜](/cloud/identify/storage-lifecycle)
- [识别网络流量里的隐形成本](/cloud/identify/network-traffic)

通用框架见 [四步法总纲](/cloud/overview/)。
```

- [ ] **Step 7: 构建、验证、提交**

Run: `npm run build && npm run test:links`
Expected: 「所有内部链接均可达」通过。

```bash
git add docs/cloud/identify
git commit -m "docs: add waste identification articles"
```

---

### Task 5: ③ 处置 —— 删、降、换

**Files:**
- Create: `docs/cloud/dispose/resize-and-downgrade.md`
- Create: `docs/cloud/dispose/billing-mode-switch.md`
- Create: `docs/cloud/dispose/reserved-vs-savings.md`
- Modify: `docs/cloud/dispose/index.md`

**Interfaces:**
- Consumes: `StepBadge`（`step: dispose`）
- Produces: 三篇处置文章，含决策依据与可执行命令

- [ ] **Step 1: 核实降配的硬约束**

对三家云核实：

- 哪些实例族 / 规格支持降配，降配后能否再变回去（**这一条决定了动作的可逆性，必须写准**）
- 降配需要停机还是热迁移
- 云盘是否必须同步降级、能否单独保留
- 有稳定期费用的资源（包年包月、预留实例）降配后的退款 / 补差规则

搜索关键词参考：`阿里云 ECS 降配 变配 限制`、`腾讯云 CVM 降配 规格`、`华为云 ECS 规格变更 降配`。

- [ ] **Step 2: 写 `docs/cloud/dispose/resize-and-downgrade.md`**

章节骨架：

```md
<StepBadge />

# 降配与缩容：动作前的三件事

## 先判断可逆性

## 降配的硬约束（各厂商差异）

## 缩容与存储分开看

## 稳定期资源降配的账怎么算

## 执行流程

## 踩过的坑

## 结论
```

- [ ] **Step 3: 核实计费模式转换规则并写 `docs/cloud/dispose/billing-mode-switch.md`**

核实要点：

- 按量付费转包年包月的入口与生效时间（是否立即生效、是否按剩余周期结算）
- 包年包月转按量付费的退订规则与退款额
- 竞价 / 抢占式实例的适用场景与被回收的后果
- 折扣活动的参与方式

章节骨架：

```md
<StepBadge />

# 换计费模式：什么时候该换

## 先算准两条曲线

## 按量转包年包月

## 包年包月转按量

## 竞价实例

## 结论
```

- [ ] **Step 4: 核实并写 `docs/cloud/dispose/reserved-vs-savings.md`**

核实要点：

- 预留实例（RI）与节省计划（SP）的覆盖范围差异
- 三种购买方式（全预付 / 部分预付 / 无预付）的成本结构
- 节省计划的承诺范围与灵活度
- 阿里云「节省计划」与腾讯云「 Savings Plan 」、华为云对应产品的实际名称与规则

搜索关键词参考：`阿里云 预留实例 节省计划 区别`、`腾讯云 节省计划 覆盖范围`、`华为云 预留实例 节省计划`。

若某厂商没有对等产品，如实说明「该厂商无对应产品」，不要硬凑映射。

章节骨架：

```md
<StepBadge />

# 预留实例还是节省计划

## 两者的本质区别

## 全预付、部分预付、无预付

## 承诺范围与灵活度

## 怎么算才划算

## 结论
```

- [ ] **Step 5: 完善目录页**

改 `docs/cloud/dispose/index.md`：

```md
---
title: ③ 处置 · 删降换
description: 对垃圾只有三种动作：删、降、换
order: 4
---

确认是垃圾之后，动作只有三种。选错动作比不动更贵。

- [降配与缩容：动作前的三件事](/cloud/dispose/resize-and-downgrade)
- [换计费模式：什么时候该换](/cloud/dispose/billing-mode-switch)
- [预留实例还是节省计划](/cloud/dispose/reserved-vs-savings)

通用框架见 [四步法总纲](/cloud/overview/)。
```

- [ ] **Step 6: 构建、验证、提交**

Run: `npm run build && npm run test:links`
Expected: 链接测试通过。

```bash
git add docs/cloud/dispose
git commit -m "docs: add disposal articles covering delete downgrade and switch"
```

---

### Task 6: ④ 防复发 —— 机制

**Files:**
- Create: `docs/cloud/prevent/tagging-standard.md`
- Create: `docs/cloud/prevent/auto-cleanup.md`
- Create: `docs/cloud/prevent/budget-alerts.md`
- Modify: `docs/cloud/prevent/index.md`

**Interfaces:**
- Consumes: `StepBadge`（`step: prevent`）
- Produces: 三篇机制文章，含可落地的规则与脚本

- [ ] **Step 1: 写 `docs/cloud/prevent/tagging-standard.md`**

核实要点：

- 各云是否有强制标签策略（策略中心 / 组织级的标签校验）
- 标签在资源创建时打与事后补打的差异（影响历史账单归属）
- 标签能否作为资源组的筛选依据

章节骨架：

```md
<StepBadge />

# 标签规范：让责任有地方可查

## 一套够用的标签体系

## 在哪一层强制

## 命名约定

## 落地路径

## 结论
```

标签体系给出一套具体方案：必填 `owner` / `app` / `env` / `created_by`，选填 `cost-center` / `expires`，并写清命名规则（大小写、前缀分隔符）与示例。

- [ ] **Step 2: 写 `docs/cloud/prevent/auto-cleanup.md`**

核实要点：

- 各云是否有官方的闲置资源检测 / 自动处置能力
- 云监控告警规则如何配置阈值与静默期

章节骨架：

```md
<StepBadge />

# 自动清理：让垃圾不需要人记得删

## 清理的三种触发

## 空转实例的自动处置

## 快照与日志的自动过期

## 误删防护：静默期与白名单

## 结论
```

给出完整可跑的检测脚本（伪代码或 Python/bash），注明所需权限。

- [ ] **Step 3: 写 `docs/cloud/prevent/budget-alerts.md`**

核实要点：

- 各云预算告警的设置入口、告警粒度（账号 / 项目 / 资源组 / 单资源）
- 告警触发是按周期还是按阈值，有无静默期设置
- 费用预测 / 预测告警能力

章节骨架：

```md
<StepBadge />

# 预算与告警：在超支之前知道

## 三层告警

## 预算怎么定才有意义

## 从异常告警到根因

## 结论
```

- [ ] **Step 4: 完善目录页**

改 `docs/cloud/prevent/index.md`：

```md
---
title: ④ 防复发 · 机制
description: 让垃圾不再堆积的四个抓手
order: 5
---

降本是持续运动。这一章决定前三步的效果能维持多久。

- [标签规范：让责任有地方可查](/cloud/prevent/tagging-standard)
- [自动清理：让垃圾不需要人记得删](/cloud/prevent/auto-cleanup)
- [预算与告警：在超支之前知道](/cloud/prevent/budget-alerts)

通用框架见 [四步法总纲](/cloud/overview/)。
```

- [ ] **Step 5: 构建、验证、提交**

Run: `npm run build && npm run test:links`
Expected: 链接测试通过。

```bash
git add docs/cloud/prevent
git commit -m "docs: add prevention mechanism articles"
```

---

### Task 7: 硬件篇 —— 捡漏专题

**Files:**
- Create: `docs/hardware/guide/where-to-hunt.md`
- Create: `docs/hardware/guide/inspection-checklist.md`
- Create: `docs/hardware/guide/cpu-field-guide.md`
- Create: `docs/hardware/guide/flip-flops.md`
- Modify: `docs/hardware/guide/index.md`

**Interfaces:**
- Consumes: 无（硬件文章不加 `StepBadge`）
- Produces: 四篇硬件专题，账本条目回链到它们

- [ ] **Step 1: 写 `docs/hardware/guide/where-to-hunt.md`**

章节骨架：

```md
# 二手机器从哪来

## 渠道一：个人二手平台

## 渠道二：企业与机构的批量处置

## 渠道三：网吧与网咖的退役机

## 渠道四：电子废弃物回收站

## 怎么判断一个渠道值不值得蹲

## 结论
```

写作要求：每个渠道说明**典型货品、风险点、验货成本**；不写具体店铺或账号推荐；涉及价格区间的地方标注「行情区间，2026-10」。

- [ ] **Step 2: 写 `docs/hardware/guide/inspection-checklist.md`**

章节骨架：

```md
# 验机清单

## 到手前的远程验机

## 开机后的第一轮

## 压力测试

## 数据与隐私

## 各类型设备的额外检查项

### 笔记本

### 台式机

### 服务器

## 结论
```

写作要求：清单要**可勾选**（用 `- [ ]` 语法），每项写清怎么验、看什么指标。风险项用 `> ⚠️` 标注。

- [ ] **Step 3: 写 `docs/hardware/guide/cpu-field-guide.md`**

章节骨架：

```md
# CPU 型号图鉴：读懂处理器型号里的信息

## 型号字符串怎么读

## 平台代号与插槽

## 常见「洋垃圾」平台的定位

## 每一代的大致定位

## 二手价与性能的取舍

## 结论
```

写作要求：只描述公开的架构与定位信息；具体频率与价格用「区间 + 时间点」表述，不给单点精确值。

- [ ] **Step 4: 写 `docs/hardware/guide/flip-flops.md`**

章节骨架：

```md
# 翻车案例：这些坑我踩过

## 案例一：矿卡的成色陷阱

## 案例二：参数虚标

## 案例三：被锁的 BIOS

## 案例四：电源与散热

## 案例五：拆机件冒充整机

## 怎么把风险挡在付款之前

## 结论
```

写作要求：案例写成「现象 → 原因 → 处理 → 代价」四段；避免指名具体卖家。

- [ ] **Step 5: 完善目录页**

改 `docs/hardware/guide/index.md`：

```md
---
title: 硬件专题
description: 捡漏方法与避坑指南
order: 2
---

方法与判断标准在这里，具体机器记在 [淘货账本](/hardware/ledger/)。

- [二手机器从哪来](/hardware/guide/where-to-hunt)
- [验机清单](/hardware/guide/inspection-checklist)
- [CPU 型号图鉴](/hardware/guide/cpu-field-guide)
- [翻车案例](/hardware/guide/flip-flops)
```

- [ ] **Step 6: 构建、验证、提交**

Run: `npm run build && npm run test:links`
Expected: 链接测试通过。

```bash
git add docs/hardware/guide
git commit -m "docs: add second-hand hardware guide articles"
```

---

### Task 8: 硬件篇 —— 淘货账本模板

**Files:**
- Create: `docs/hardware/ledger/thinkpad-t14-gen2.md`
- Create: `docs/hardware/ledger/dell-optiplex-3070.md`
- Modify: `docs/hardware/ledger/index.md`

**Interfaces:**
- Consumes: `LedgerCard` 组件（Task 5，基础设施计划）
- Produces: 两篇账本模板，作者照着替换为真实机器

- [ ] **Step 1: 写模板条目**

两篇结构完全一致，只换机器型号。以 `docs/hardware/ledger/thinkpad-t14-gen2.md` 为例：

```md
---
title: ThinkPad T14 Gen 2
description: 待填：一句话概括这台机器的定位
date: 2026-10-26
acquired: 待填
price: 待填
condition: 待填
source: 待填
verdict: 值
specs:
  cpu: 待填
  ram: 待填
  storage: 待填
  screen: 待填
---

<LedgerCard />

## 到手实测

<!-- 待填：开机情况、屏幕、键盘、电池健康度、接口实测 -->

## 翻车点

<!-- 待填：到手后遇到的问题与处理方式 -->

## 值不值

<!-- 待填：结论 + 同类机型同期行情对比 -->
```

> `verdict` 只能是 `值` / `勉强` / `不值` 三个值之一，组件按此映射配色。写其他值会退化成中性色。

`docs/hardware/ledger/dell-optiplex-3070.md` 同构，型号换成 Dell OptiPlex 3070（台式机方向，用于展示另一种参数结构：`specs` 可以只写 `cpu` / `ram` / `storage` 三项）。

- [ ] **Step 2: 完善账本索引**

改 `docs/hardware/ledger/index.md`：

````md
---
title: 淘货账本
description: 每台捡回来的机器一页
order: 1
---

一台机器一页，记四件事：**多少钱、从哪来、到手什么样、值不值**。

## 每篇的结构

| 区块 | 内容 |
|---|---|
| 价签卡片 | 入手价、成色、渠道、关键参数、结论 |
| 到手实测 | 开机、屏幕、键盘、电池健康度、接口 |
| 翻车点 | 遇到的问题与处理方式 |
| 值不值 | 结论与同期同类行情对比 |

## 怎么看这些记录

[验机清单](/hardware/guide/inspection-checklist) 里的项目就是「到手实测」应该覆盖的内容。
[翻车案例](/hardware/guide/flip-flops) 汇总了这些记录里最常出现的问题类型。

## 全部记录

- [ThinkPad T14 Gen 2](/hardware/ledger/thinkpad-t14-gen2)
- [Dell OptiPlex 3070](/hardware/ledger/dell-optiplex-3070)
````

- [ ] **Step 3: 删掉演示用的示例条目**

`docs/hardware/ledger/thinkpad-x1-carbon-gen9.md` 是基础设施计划里的组件演示页（数据为虚构）。内容计划完成后删除，避免与真实账本混淆。

Run: `git rm docs/hardware/ledger/thinkpad-x1-carbon-gen9.md`
Expected: 文件从索引中移除。

**注意**：`tests/build.test.mjs` 里有针对该页面的断言，必须同步更新为新模板条目。

- [ ] **Step 4: 更新集成测试**

把 `tests/build.test.mjs` 中账本卡片的断言改为指向新模板页：

```js
test('账本卡片渲染 frontmatter 字段', () => {
  const page = html('hardware', 'ledger', 'thinkpad-t14-gen2.html')
  assert.match(page, /ledger-card__verdict/)
  assert.match(page, /到手实测/)
})
```

- [ ] **Step 5: 构建、验证、提交**

Run: `npm run build && npm run test:build && npm run test:links`
Expected: 全部通过；此时「页面数量与内容目录规模相称」断言也应转绿（页面数 ≥ 15）。

```bash
git add docs/hardware/ledger tests/build.test.mjs
git commit -m "docs: add ledger entry templates and index"
```

---

### Task 9: 云账单篇首页与交叉链接补全

**Files:**
- Modify: `docs/cloud/index.md`
- Modify: `docs/hardware/index.md`
- Modify: `docs/index.md`

**Interfaces:**
- Consumes: Task 3–8 产出的全部文章
- Produces: 三级索引结构完整、无悬空链接的站点

- [ ] **Step 1: 补全 `docs/cloud/index.md`**

把云账单篇首页改成按四步分组列出全部文章：

```md
---
title: 云账单篇
sidebar_label: 云账单
description: 用四步法把云上被浪费的钱捡回来
order: 1
---

云上闲置资源是「垃圾」。这篇用 **看见 → 识别 → 处置 → 防复发** 四步法，
把账单里的水分一点点挤出来。

先读 [四步法总纲](/cloud/overview)。

## ① 看见 · 成本可见性

[阿里云用标签做成本分摊](/cloud/visibility/aliyun-tag-cost) ·
[腾讯云按项目归集成本](/cloud/visibility/tencent-project-cost) ·
[华为云用企业项目归集成本](/cloud/visibility/huawei-eps-cost)

## ② 识别 · 找到垃圾

[识别空跑的计算资源](/cloud/identify/idle-compute) ·
[识别孤儿资源](/cloud/identify/orphan-resources) ·
[存储生命周期](/cloud/identify/storage-lifecycle) ·
[网络流量隐形成本](/cloud/identify/network-traffic)

## ③ 处置 · 删降换

[降配与缩容](/cloud/dispose/resize-and-downgrade) ·
[换计费模式](/cloud/dispose/billing-mode-switch) ·
[预留实例还是节省计划](/cloud/dispose/reserved-vs-savings)

## ④ 防复发 · 机制

[标签规范](/cloud/prevent/tagging-standard) ·
[自动清理](/cloud/prevent/auto-cleanup) ·
[预算与告警](/cloud/prevent/budget-alerts)
```

- [ ] **Step 2: 补全 `docs/hardware/index.md`**

```md
---
title: 二手硬件篇
sidebar_label: 二手硬件
description: 从废品堆里捡回来的机器，和它们的真实价格
order: 2
---

实体废品堆也是「垃圾」。这一篇记两类东西：

## 淘货账本

一台机器一页，记四件事：**多少钱、从哪来、到手什么样、值不值**。

[查看全部记录](/hardware/ledger/)

## 硬件专题

- [二手机器从哪来](/hardware/guide/where-to-hunt)
- [验机清单](/hardware/guide/inspection-checklist)
- [CPU 型号图鉴](/hardware/guide/cpu-field-guide)
- [翻车案例](/hardware/guide/flip-flops)
```

- [ ] **Step 3: 首页补「最近更新」区块**

在 `docs/index.md` 的 `## 两大主线` 之后追加：

```md
## 最近在写什么

- [四步法总纲](/cloud/overview/) —— 云账单降本的通用框架
- [验机清单](/hardware/guide/inspection-checklist) —— 到手前该看什么
- [淘货账本](/hardware/ledger/) —— 每台捡回来的机器一页
```

- [ ] **Step 4: 全量验证**

Run: `npm test`
Expected: 单元测试、构建、产物断言、链接断言四段全绿，「页面数量与内容目录规模相称」断言通过。

- [ ] **Step 5: 把链接断言接进 CI**

改 `.github/workflows/deploy.yml`，在 `Build output tests` 之后插入一步：

```yaml
      - name: Link check
        run: npm run test:links
```

改 `.github/workflows/deploy.yml` 中 `Build output tests` 这一步，确认它在 `Build` 之后：

```yaml
      - name: Build output tests
        run: npm run test:build

      - name: Link check
        run: npm run test:links
```

- [ ] **Step 6: 更新 README 的测试说明**

改 `README.md` 中 `npm test` 那一行：

```bash
npm test           # 单元测试 + 构建 + 产物断言 + 链接断言
```

- [ ] **Step 7: 提交**

```bash
git add docs/cloud/index.md docs/hardware/index.md docs/index.md .github/workflows/deploy.yml README.md
git commit -m "docs: complete index pages, cross links and link check in ci"
```

---

## 完成标准

```bash
npm test    # 单元 + 构建 + 产物断言 + 链接断言，全绿
```

内容覆盖对照 spec 第 6 节：

| spec 要求 | 对应任务 |
|---|---|
| 四步法总纲 | Task 2 |
| 可见性（阿里云 / 腾讯云 / 华为云） | Task 3 |
| 识别（空跑 / 孤儿 / 存储 / 网络） | Task 4 |
| 处置（降配 / 计费模式 / RI vs SP） | Task 5 |
| 防复发（标签 / 自动清理 / 预算告警） | Task 6 |
| 硬件专题（渠道 / 验机 / CPU / 翻车） | Task 7 |
| 硬件账本模板（空模板，后续由作者填） | Task 8 |
| 索引与交叉链接 | Task 9 |

遗留：真实机器数据由作者后续替换 Task 8 的模板。
