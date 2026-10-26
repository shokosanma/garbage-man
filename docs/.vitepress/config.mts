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
