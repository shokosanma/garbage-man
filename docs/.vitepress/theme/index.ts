import DefaultTheme from 'vitepress/theme-without-fonts'
import type { Theme } from 'vitepress'
import LedgerCard from './components/LedgerCard.vue'
import StepBadge from './components/StepBadge.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LedgerCard', LedgerCard)
    app.component('StepBadge', StepBadge)
  },
} satisfies Theme
