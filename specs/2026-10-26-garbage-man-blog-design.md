# garbage-man 博客站点设计文档

- 日期：2026-10-26
- 状态：已确认，待实施
- 仓库：`garbage-man`（名称不修改）
- 目标地址：`https://shokosanma.github.io/garbage-man/`

## 1. 背景与目标

在 GitHub 上建设一个个人博客站点，沉淀两类内容：

1. **云服务降本经验** —— 以国内云厂商（阿里云 / 腾讯云 / 华为云）为主。
2. **二手硬件内容** —— 以「淘货账本 + 硬件专题」两种形态呈现。

仓库名 `garbage-man` 被有意保留，并成为全站主线：**从云账单和废品堆里，捡回被丢掉的钱**。云上闲置资源是「垃圾」，二手硬件是「废品堆」，两者共享同一个隐喻。

### 成功标准

- 新增一篇内容 = 放入一个 `.md` 文件，不修改任何配置。
- 本地 `npm run dev` 可即时预览，推送 `main` 后自动上线。
- 站点在弱网 / 无 Google Fonts 的环境下仍能正常加载与阅读。

### 非目标

- 不做多用户 / 登录 / 评论。
- 不做云厂商 API 接入或账单自动化看板（内容以文章与手写账本为主）。
- 不引入外部图床，图片一律存仓库。
- 不做 i18n，当前仅中文。

## 2. 关键决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| 素材来源 | 混合：主线经验由作者提供，框架与延伸由 AI 补齐 | 纯手写易流水账，纯整理缺数字说服力 |
| 站点框架 | VitePress 1.6.4（Node 24 已验证可用） | 作者环境已有 Node 24 + npm 10.8.2 |
| 导航生成 | 目录树即导航，由脚本生成侧边栏 | 清单类内容会持续追加，手写 sidebar 会崩 |
| 内容形态 | 账本（一机一篇）+ 专题（长文）混合 | 二手硬件天然有两种信息密度 |
| 云厂商范围 | 国内云为主 | 国内计费规则差异大，实操细节可写深 |
| 图片 | 存仓库 `public/images/` | 不依赖外部服务 |
| 仓库名 | 保持 `garbage-man` | 作为统一主题的一部分 |
| 设计文档位置 | `specs/`（非 `docs/`） | `src/` 才是站点内容目录，避免设计文档被发布 |

### 已否决的方案

- **frontmatter 全驱动 + 动态筛选排序**：灵活但需维护生成脚本；实际很少按日期翻二手硬件账本。保留脚本，但脚本只做「目录树 → 侧边栏」的确定性映射。
- **手写 sidebar**：维护成本随文章数线性上涨。
- **双仓库 / 双站点**：主题维护两份，导航割裂，部署复杂，属过度设计。
- **Jekyll（GitHub Pages 原生）**：虽然零工具链，但主题定制能力弱于 VitePress，且无法承载自定义 Vue 组件（账本卡片）。

## 3. 仓库结构

```
garbage-man/
├── docs/                      # 站点内容根（VitePress root = docs/）
│   ├── .vitepress/
│   │   ├── config.mts
│   │   ├── sidebar.ts         # 侧边栏生成器，config 加载时直接调用
│   │   └── theme/
│   │       ├── index.ts
│   │       ├── style.css
│   │       └── components/
│   │           ├── LedgerCard.vue
│   │           └── StepBadge.vue
│   ├── public/
│   │   └── images/
│   │       ├── cloud/
│   │       └── hardware/
│   ├── index.md
│   ├── cloud/
│   │   ├── index.md
│   │   ├── overview.md
│   │   ├── visibility/
│   │   ├── identify/
│   │   ├── dispose/
│   │   └── prevent/
│   └── hardware/
│       ├── index.md
│       ├── ledger/
│       └── guide/
├── specs/                     # 设计 / 实施文档（不参与构建）
├── tests/                     # node:test 单元测试 + 构建产物集成测试
├── dist/                      # 构建产物（gitignore）
├── .github/workflows/deploy.yml
├── package.json
├── .npmrc
├── .gitignore
└── README.md
```

VitePress 配置：`srcDir: '.'`（相对 `docs/`）、`outDir: '../dist'`（仓库根）、`base: '/garbage-man/'`、`appearance: 'force-dark'`。

采用 VitePress 标准布局（root = `docs/`）而非自定义 `srcDir`，原因是 root 与 srcDir 相同时所有路径解析无歧义，`publicDir` 与 `outDir` 的相对基准唯一。

侧边栏由 `docs/.vitepress/sidebar.ts` 在 config 加载时同步计算，**不产出也不提交任何生成文件**，因此不存在「改了内容忘了重新生成」的中间态。生成器与 config 同目录，避免跨目录相对导入在 esbuild 打包 config 时出问题。

### 排序机制

不使用数字前缀（否则 URL 变成 `/cloud/10-visibility/`）。改由每个内容目录的 `index.md` frontmatter 写 `order: <n>`，生成脚本据此排序；缺省时按目录名 / 文件名字母序。URL 保持语义干净。

## 4. 内容模型

统一 frontmatter 驱动。生成脚本读取目录树，读取每个目录 `index.md` 的 `title`（或 `sidebar_label`）作为分组显示名，读取 `order` 决定排序。

### 4.1 文章（云降本 / 硬件专题）

```yaml
---
title: 阿里云账单标签成本分摊实战
description: 用标签把 ECS/OSS/RDS 的开销拆到团队和人
date: 2026-10-26
cloud: 阿里云          # 阿里云 | 腾讯云 | 华为云
tags: [成本分摊, 标签]
---
```

### 4.2 账本条目（一台机器一篇）

```yaml
---
title: ThinkPad X1 Carbon Gen 9
description: 3200 元入手的 95 新轻薄本，价格锚点观察样本
date: 2026-10-26
acquired: 2026-03-15
price: 3200
condition: 95新
source: 闲鱼
specs:
  cpu: i7-1185G7
  ram: 16G
  storage: 1T NVMe
  screen: 14" 2.8K OLED
verdict: 值          # 值 | 勉强 | 不值
---
```

渲染形态分两种：

- **账本页**：顶部为「价签卡片」（左侧打孔、虚线边框、荧光标签展示价格与 verdict），正文为到手实测、翻车点、结论。由 `<LedgerCard />` 组件读取 frontmatter 渲染，每篇仅需多写一行。
- **文章页**：常规文档布局。

### 4.3 布局机制决策（已实测定型）

**采用默认 `doc` 布局 + 正文首行 `<LedgerCard />`。** 不引入 VitePress 自定义 layout 机制。

理由：自定义 layout 依赖 VitePress 主题内部结构，行为不确定且收益有限（仅省掉正文一行组件调用）；默认 doc 布局反而提供合适的阅读栏宽、侧边栏与大纲。已实测确认 `<LedgerCard />` 通过 `useData()` 读取 frontmatter 正常渲染（`¥3200`、`is-good`、`i7-1185G7` 均正确出现在构建产物中）。

组件读取 `useData()` 的 frontmatter，无需额外传参。

### 4.4 构建期依赖约束（已实测）

VitePress 的 config 打包器**不内联 node_modules 依赖**，被 config 引用的包必须在 `package.json` 中真实安装。`gray-matter`（frontmatter 解析）因此列为 devDependency，缺失时构建直接报 `ERR_MODULE_NOT_FOUND`。

## 5. 站点与主题

- **强制深色**：`appearance: 'force-dark'`（无明暗切换，保证定制配色不被破坏）。底色 `#0d1117`，主色荧光绿 `#00E27A`，点缀警示黄 `#FFC400`。
- **字体只用系统栈**，不引 Google Fonts / 任何外链字体。国内访问 Google Fonts 会加载失败并拖慢首屏。代码与参数使用 `ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace`。
- **首页**：Hero（标语「从云账单和废品堆里，捡回被丢掉的钱」）+ 两大主线入口卡片 + 最近更新列表。
- **配色克制**：荧光绿仅用于 verdict、价格、正文链接等少量点缀，不满屏铺色。
- **图片**：引用形如 `/images/hardware/xxx.jpg`（base 自动前缀）。

## 6. 首批内容

### 6.1 云账单篇 —— 「云账单解剖四步法」主线

框架：**看见 → 识别 → 处置 → 防复发**。

| 目录 | 内容 |
|---|---|
| `cloud/overview.md` | 四步法总纲（纯方法论） |
| `cloud/visibility/` | 阿里云标签成本分摊、腾讯云项目归集、华为云企业项目 |
| `cloud/identify/` | 空跑实例识别、未挂载云盘/EIP/快照、存储生命周期、跨地域流量费 |
| `cloud/dispose/` | 降配条件、计费模式转换、RI vs 节省计划 |
| `cloud/prevent/` | 标签规范、自动清理、预算告警 |

**核实要求**：涉及厂商计费规则、控制台路径、监控指标名的内容，必须联网核实后落笔。核实不到的留空并标注，不用记忆凑数。

### 6.2 硬件篇

| 目录 | 内容 |
|---|---|
| `hardware/guide/where-to-hunt.md` | 渠道：闲鱼、网吧淘汰机、企业批量处置、e-waste 回收站 |
| `hardware/guide/inspection-checklist.md` | 验机清单 |
| `hardware/guide/cpu-field-guide.md` | 洋垃圾 CPU 图鉴 |
| `hardware/guide/flip-flops.md` | 翻车案例：矿卡、虚标、锁 BIOS、电源虚标 |
| `hardware/ledger/` | 淘货账本，**首批放空模板**，后续由作者填真实机器 |

硬件内容多为通用知识，核实成本低。首批创建 **2 篇账本条目作为模板**：frontmatter 字段齐全，但 `price` / `acquired` / `specs` 等留空并标注「待填」，正文给出「到手实测 / 翻车点 / 值不值结论」三段写作指引。作者后续替换为真实机器数据。

## 7. 构建与发布

- 本地：`npm run dev` 预览，`npm run build` 构建，`npm run preview` 预览产物。
- CI：推送 `main` → GitHub Actions → `npm ci && npm run build` → 部署 `src/.vitepress/dist` 到 `gh-pages` 分支。
- 仓库设置：Pages → Source = **GitHub Actions**；Actions workflow 需要 `contents: write` 权限。

### 环境问题（需在实施时解决）

1. **npm 代理**：当前环境 `HTTP_PROXY` / `HTTPS_PROXY` 指向 `node-rpi:9081`，该主机已下线（`/etc/hosts` 中条目被注释，`192.168.0.104:9081` 不可达），npm 会长时间挂起。直连 registry.npmmirror.com 正常（0.5s）。
   - **已实测确认**：项目 `.npmrc` 写入 `noproxy=*` 即可解决（`npm view` 从挂起变为 0.5s 返回）。
   - 兜底：`env -u HTTP_PROXY -u HTTPS_PROXY npm install`，写入 README。
   - CI 环境无此代理变量，不受影响。
2. **gh token 失效**：`gh auth status` 显示 `shokosanma` 账号 token 无效，推送前需 `gh auth refresh -h github.com`。

## 8. 实施步骤与验证点

| # | 步骤 | 验证点 |
|---|---|---|
| 1 | 脚手架、`.gitignore`、`.npmrc`、`package.json` | 依赖可安装 |
| 2 | 打通 npm 代理问题 | **A**：VitePress 在 Node 24 下 `dev` + `build` 均通过（**已预验证**） |
| 3 | `config.mts` + 主题 CSS | 站点可启动，深色主题生效 |
| 4 | `docs/.vitepress/sidebar.ts` + 集成进 config | **B**：侧边栏层级与 `order` 排序正确 |
| 5 | `LedgerCard.vue` / `StepBadge.vue` | **C**：账本卡片正确渲染 frontmatter（**已预验证**） |
| 6 | 首页 | Hero、双主线入口、最近更新列表正常 |
| 7 | 内容骨架与首批文章 | 目录结构符合第 3 节；厂商细节已核实 |
| 8 | CI 工作流 + 部署 | 推 `main` 后站点可访问 |
| 9 | README | 含写作规范与「新增文章指引」 |

## 9. 风险与遗留项

| 风险 | 影响 | 应对 |
|---|---|---|
| 侧边栏生成逻辑未实测 | 导航结构可能不符合预期 | 验证点 B 优先做；必要时退化为手写 JSON |
| 构建期依赖漏装 | 构建报 `ERR_MODULE_NOT_FOUND` | 已在 4.4 记录约束；`gray-matter` 列入 devDependencies |
| 厂商资料核实不实 | 文章误导读者 | 核实不到即留空标注，禁止凭记忆书写 |
| npm 代理环境异常 | 本地无法安装依赖 | 验证点 A 优先解决，写入 README |
| 仓库体积增长 | 图片占用空间 | 图片压缩后再提交；必要时后续引入 LFS |

### 遗留待办

- 首批账本的真实机器数据由作者后续补充。
- 域名 `garbage-man.github.io` 之外的独立域名暂不规划。
- 是否加入评论、订阅（RSS）暂不纳入本期。

## 10. 内容创作规范

**文章骨架**：引子 / 背景 → 问题 → 方案 → 可复现的命令与数据 → 踩过的坑 → 结论。

**账本骨架**：图片 → 关键参数表 → 入手价 / 渠道 / 时间 → 到手实测 → 翻车点 → 值不值结论。

**写作要求**：

- 命令可直接复制执行，标注运行平台与权限要求。
- 数据需标明来源与时间点（云厂商价格与规则变动频繁）。
- 不确定的内容明确标注「待核实」，不留模糊表述。
- 厂商特有能力注明厂商名，通用思路单独成篇，避免重复。
