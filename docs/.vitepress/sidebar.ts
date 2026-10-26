import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

export interface SidebarItem {
  text: string
  link?: string
  collapsed?: boolean
  items?: SidebarItem[]
}

interface Frontmatter {
  title?: string
  sidebar_label?: string
  order?: number
}

interface OrderedItem extends SidebarItem {
  _order: number
  _kind: 'dir' | 'file'
  _path: string
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'public'])
const DEFAULT_ORDER = 999

function readFrontmatter(file: string): Frontmatter {
  if (!fs.existsSync(file)) return {}
  try {
    // 传 options 绕开 gray-matter 的内容缓存：它会在解析前写入缓存，
    // 解析失败后同一内容再解析会静默返回空 frontmatter，错误也随之消失。
    const { data } = matter(fs.readFileSync(file, 'utf8'), {})
    return data as Frontmatter
  } catch (err) {
    throw new Error(`[sidebar] frontmatter 解析失败: ${file}`, { cause: err })
  }
}

function resolveOrder(order: unknown): number {
  if (order === undefined || order === null || order === '') return DEFAULT_ORDER
  const n = Number(order)
  return Number.isFinite(n) ? n : DEFAULT_ORDER
}

function relPath(srcDir: string, absFile: string): string {
  return path.relative(srcDir, absFile).split(path.sep).join('/')
}

function toUrl(srcDir: string, absFile: string): string {
  const rel = relPath(srcDir, absFile)
  if (rel === 'index.md') return '/'
  if (rel.endsWith('/index.md')) return '/' + rel.slice(0, -'index.md'.length)
  return '/' + rel.replace(/\.md$/, '')
}

function buildLeaf(fileAbs: string, srcDir: string): OrderedItem {
  const fm = readFrontmatter(fileAbs)
  return {
    text: fm.sidebar_label ?? fm.title ?? path.basename(fileAbs, '.md'),
    link: toUrl(srcDir, fileAbs),
    _order: resolveOrder(fm.order),
    _kind: 'file',
    _path: relPath(srcDir, fileAbs),
  }
}

function buildGroup(dirAbs: string, srcDir: string): OrderedItem | null {
  const indexFile = path.join(dirAbs, 'index.md')
  if (!fs.existsSync(indexFile)) return null
  const fm = readFrontmatter(indexFile)
  return {
    text: fm.sidebar_label ?? fm.title ?? path.basename(dirAbs),
    link: toUrl(srcDir, indexFile),
    collapsed: false,
    items: buildChildren(dirAbs, srcDir),
    _order: resolveOrder(fm.order),
    _kind: 'dir',
    _path: relPath(srcDir, indexFile),
  }
}

function buildChildren(dirAbs: string, srcDir: string): SidebarItem[] {
  const collected: OrderedItem[] = []
  for (const entry of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
    const abs = path.join(dirAbs, entry.name)
    if (entry.isDirectory()) {
      const group = buildGroup(abs, srcDir)
      if (group) collected.push(group)
    } else if (entry.name.endsWith('.md') && entry.name !== 'index.md') {
      collected.push(buildLeaf(abs, srcDir))
    }
  }
  return collected.sort(compare).map(strip)
}

function compare(a: OrderedItem, b: OrderedItem): number {
  if (a._order !== b._order) return a._order - b._order
  if (a._kind !== b._kind) return a._kind === 'file' ? -1 : 1
  const byText = a.text.localeCompare(b.text, 'zh-Hans-CN')
  if (byText !== 0) return byText
  if (a._path === b._path) return 0
  return a._path < b._path ? -1 : 1
}

function strip(item: OrderedItem): SidebarItem {
  const { _order, _kind, _path, ...rest } = item
  return rest
}

export function buildSidebar(srcDir: string): SidebarItem[] {
  const root = path.resolve(srcDir)
  if (!fs.existsSync(root)) {
    throw new Error(`[sidebar] 内容目录不存在: ${root}`)
  }
  return buildChildren(root, root)
}
