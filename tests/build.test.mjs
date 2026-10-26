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
