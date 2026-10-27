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
- **图片文件和引用必须同时存在** —— Markdown 里写 `/images/子目录/文件名`，
  文件就放 `docs/public/images/子目录/文件名`（**不要手写 base 前缀**，
  写成 `/garbage-man/images/xxx.jpg` 会让构建失败）。缺了文件同样会失败
  （实测：Rollup 解析不到这个资源）。
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
