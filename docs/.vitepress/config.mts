import { defineConfig } from 'vitepress'
import path from 'node:path'
import { buildSidebar } from './sidebar.ts'

// 以配置文件自身位置推导内容根，与调用方的 cwd 无关。
const CONTENT_ROOT = path.resolve(import.meta.dirname, '..')

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
    sidebar: buildSidebar(CONTENT_ROOT),
  },
})
