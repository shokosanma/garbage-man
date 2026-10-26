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
