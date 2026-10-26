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

// 零字体契约唯一的自动化关卡：Task 8 的 CI 只跑这三个 npm script。
// 原来这条只查 googleapis/gstatic，查不出 VitePress 自带的本地 Inter woff2 ——
// 把主题入口退回 vitepress/theme 时，产物里会多出 14 个 woff2、1 条 @font-face、
// 12 个字体 preload、产物从 340K 涨到 1.2M，而旧断言全绿。
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
