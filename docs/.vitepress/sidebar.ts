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
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'public'])
const DEFAULT_ORDER = 999

function readFrontmatter(file: string): Frontmatter {
  if (!fs.existsSync(file)) return {}
  const { data } = matter(fs.readFileSync(file, 'utf8'))
  return data as Frontmatter
}

function toUrl(srcDir: string, absFile: string): string {
  const rel = path.relative(srcDir, absFile).split(path.sep).join('/')
  if (rel === 'index.md') return '/'
  if (rel.endsWith('/index.md')) return '/' + rel.slice(0, -'index.md'.length)
  return '/' + rel.replace(/\.md$/, '')
}

function buildLeaf(fileAbs: string, srcDir: string): OrderedItem {
  const fm = readFrontmatter(fileAbs)
  return {
    text: fm.title ?? path.basename(fileAbs, '.md'),
    link: toUrl(srcDir, fileAbs),
    _order: fm.order ?? DEFAULT_ORDER,
    _kind: 'file',
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
    _order: fm.order ?? DEFAULT_ORDER,
    _kind: 'dir',
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
  return a.text.localeCompare(b.text, 'zh-Hans-CN')
}

function strip(item: OrderedItem): SidebarItem {
  const { _order, _kind, ...rest } = item
  return rest
}

export function buildSidebar(srcDir: string): SidebarItem[] {
  const root = path.resolve(srcDir)
  if (!fs.existsSync(root)) {
    throw new Error(`[sidebar] 内容目录不存在: ${root}`)
  }
  const collected: OrderedItem[] = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
    const abs = path.join(root, entry.name)
    if (entry.isDirectory()) {
      const group = buildGroup(abs, root)
      if (group) collected.push(group)
    } else if (entry.name.endsWith('.md') && entry.name !== 'index.md') {
      collected.push(buildLeaf(abs, root))
    }
  }
  return collected.sort(compare).map(strip)
}
