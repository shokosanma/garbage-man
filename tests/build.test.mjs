import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const DIST = path.resolve(process.cwd(), 'dist')

function html(...segments) {
  return fs.readFileSync(path.join(DIST, ...segments), 'utf8')
}

function exists(...segments) {
  return fs.existsSync(path.join(DIST, ...segments))
}

test('首页已生成', () => {
  assert.ok(exists('index.html'))
})

test('资源链接带 base 前缀', () => {
  assert.match(html('index.html'), /\/garbage-man\/assets\//)
})

test('账本卡片渲染 frontmatter 字段', () => {
  const page = html('hardware', 'ledger', 'thinkpad-x1-carbon-gen9.html')
  assert.match(page, /¥3200/)
  assert.match(page, /is-good/)
  assert.match(page, /i7-1185G7/)
  assert.match(page, /95新/)
})

test('没有引入外链字体', () => {
  const cssDir = path.join(DIST, 'assets')
  const cssFile = fs.readdirSync(cssDir).find((f) => f.startsWith('style.') && f.endsWith('.css'))
  assert.ok(cssFile, '未找到编译后的样式文件')
  const css = fs.readFileSync(path.join(cssDir, cssFile), 'utf8')
  assert.doesNotMatch(css, /fonts\.googleapis|fonts\.gstatic/)
})
