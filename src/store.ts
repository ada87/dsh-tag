import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { HttpError } from './errors.js'
import {
  PROTOCOL_VERSION,
  type Snapshot,
  type Tag,
  type TagPatch,
  type WorkspaceTag,
} from './protocol.js'

const RESERVED_IDS = new Set(['events', 'health', 'sessions', 'workspaces'])
const NAMED_COLORS = new Set([
  'green', 'amber', 'blue', 'red', 'purple',
  'gray', 'teal', 'pink', 'indigo', 'brown',
])
const MAX_TAGS = 10
const STATE_VERSION = 1

/** Business-oriented defaults; IDs stay stable so assignments survive renames. */
const DEFAULT_TAGS: ReadonlyArray<readonly [id: string, label: string, color: string]> = [
  ['design', '设计', 'purple'],
  ['code', '编码', 'blue'],
  ['ops', '运营', 'green'],
  ['temp', '临时', 'gray'],
]

interface PersistedTag {
  id: string
  label: string
  color: string
  order: number
  createdAt: number
}

interface PersistedWorkspace {
  tagId: string
  path?: string
}

interface PersistedState {
  version: number
  tags: PersistedTag[]
  sessions: Record<string, string>
  workspaces: Record<string, PersistedWorkspace>
}

export interface TagStore {
  snapshot(): Snapshot
  createTag(label: unknown, color: unknown): Tag
  updateTag(id: string, patch: TagPatch): Tag
  deleteTag(id: string): void
  assign(kind: 'session' | 'workspace', targetId: string, tagId: string | null, path?: string): void
  close(): void
}

/**
 * State lives in `<DSH_HOME>/state/dsh-tag.json`. A file keeps the plugin
 * independent of the storage-domain composition, which is not mounted in
 * every profile.
 */
export function openTagStore(
  file: string,
  workspacePath: (id: string) => string | undefined,
): TagStore {
  let state = loadState(file)

  const save = (next: PersistedState): void => {
    const dir = dirname(file)
    mkdirSync(dir, { recursive: true })
    const tmp = `${file}.tmp`
    writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    renameSync(tmp, file)
    state = next
  }

  if (!existsSync(file)) {
    try {
      save(state)
    } catch {
      // A read-only home keeps the seeded state in memory; mutations fail loudly.
    }
  }

  const tags = (): Tag[] => state.tags.map(tag => ({
    id: tag.id,
    label: tag.label,
    color: tag.color,
    order: tag.order,
  }))

  const snapshot = (): Snapshot => {
    const list = tags()
    const known = new Set(list.map(tag => tag.id))
    const sessions: Record<string, string> = {}
    for (const [id, tagId] of Object.entries(state.sessions)) {
      if (known.has(tagId)) sessions[id] = tagId
    }
    const workspaces: WorkspaceTag[] = []
    for (const [id, assignment] of Object.entries(state.workspaces)) {
      if (!known.has(assignment.tagId)) continue
      const path = workspacePath(id) ?? assignment.path
      workspaces.push({ id, ...(path === undefined || path.length === 0 ? {} : { path }), tagId: assignment.tagId })
    }
    workspaces.sort((left, right) => left.id.localeCompare(right.id))
    return { version: PROTOCOL_VERSION, updatedAt: Date.now(), tags: list, sessions, workspaces }
  }

  const createTag = (rawLabel: unknown, rawColor: unknown): Tag => {
    if (state.tags.length >= MAX_TAGS) {
      throw new HttpError(409, 'tag-limit', `at most ${MAX_TAGS} tags are supported`)
    }
    const label = normalizeLabel(rawLabel)
    const color = requireColor(rawColor)
    if (state.tags.some(tag => tag.color === color)) {
      throw new HttpError(409, 'color-in-use', `color "${color}" is already used`)
    }
    const id = newTagId(state.tags)
    const order = nextOrder(state.tags)
    const tag: PersistedTag = { id, label, color, order, createdAt: Date.now() }
    save({ ...state, tags: [...state.tags, tag] })
    return { id, label, color, order }
  }

  const updateTag = (id: string, patch: TagPatch): Tag => {
    const index = state.tags.findIndex(tag => tag.id === id)
    if (index === -1) throw new HttpError(404, 'tag-not-found', `no tag "${id}"`)
    const current = state.tags[index]!
    const color = patch.color === undefined ? current.color : requireColor(patch.color)
    if (color !== current.color && state.tags.some(tag => tag.id !== id && tag.color === color)) {
      throw new HttpError(409, 'color-in-use', `color "${color}" is already used`)
    }
    const next: PersistedTag = {
      ...current,
      ...(patch.label === undefined ? {} : { label: normalizeLabel(patch.label) }),
      color,
      ...(patch.order === undefined ? {} : { order: normalizeOrder(patch.order) }),
    }
    const list = [...state.tags]
    list[index] = next
    save({ ...state, tags: list })
    return { id: next.id, label: next.label, color: next.color, order: next.order }
  }

  const deleteTag = (id: string): void => {
    if (!state.tags.some(tag => tag.id === id)) throw new HttpError(404, 'tag-not-found', `no tag "${id}"`)
    const sessions: Record<string, string> = {}
    for (const [sessionId, tagId] of Object.entries(state.sessions)) {
      if (tagId !== id) sessions[sessionId] = tagId
    }
    const workspaces: Record<string, PersistedWorkspace> = {}
    for (const [workspaceId, assignment] of Object.entries(state.workspaces)) {
      if (assignment.tagId === id) continue
      workspaces[workspaceId] = { tagId: assignment.tagId, ...(assignment.path === undefined ? {} : { path: assignment.path }) }
    }
    save({ ...state, tags: state.tags.filter(tag => tag.id !== id), sessions, workspaces })
  }

  const assign = (
    kind: 'session' | 'workspace',
    targetId: string,
    tagId: string | null,
    path?: string,
  ): void => {
    const id = targetId.trim()
    if (id.length === 0 || id.length > 256) throw new HttpError(400, 'bad-target', 'a non-empty target id is required')
    if (tagId !== null) {
      if (typeof tagId !== 'string' || tagId.length === 0 || tagId.length > 64) {
        throw new HttpError(400, 'bad-tag', 'tagId must be a non-empty string or null')
      }
      if (!state.tags.some(tag => tag.id === tagId)) throw new HttpError(400, 'tag-not-found', `no tag "${tagId}"`)
    }

    if (kind === 'session') {
      const sessions = { ...state.sessions }
      if (tagId === null) delete sessions[id]
      else sessions[id] = tagId
      save({ ...state, sessions })
      return
    }
    const workspaces = { ...state.workspaces }
    if (tagId === null) {
      delete workspaces[id]
    } else {
      const previous = workspaces[id]?.path
      const nextPath = typeof path === 'string' && path.trim().length > 0 ? path.trim().slice(0, 4096) : previous
      workspaces[id] = { tagId, ...(nextPath === undefined ? {} : { path: nextPath }) }
    }
    save({ ...state, workspaces })
  }

  return {
    snapshot,
    createTag,
    updateTag,
    deleteTag,
    assign,
    close: () => undefined,
  }
}

function loadState(file: string): PersistedState {
  if (!existsSync(file)) return seed()
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown
    return normalizeState(raw)
  } catch {
    return seed()
  }
}

function seed(): PersistedState {
  const now = Date.now()
  let order = 10
  const tags: PersistedTag[] = DEFAULT_TAGS.map(([id, label, color]) => {
    const tag = { id, label, color, order, createdAt: now }
    order += 10
    return tag
  })
  return { version: STATE_VERSION, tags, sessions: {}, workspaces: {} }
}

function normalizeState(raw: unknown): PersistedState {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return seed()
  const record = raw as Record<string, unknown>
  const tags = normalizeTags(record.tags) ?? seed().tags
  const known = new Set(tags.map(tag => tag.id))

  const sessions: Record<string, string> = {}
  if (record.sessions !== null && typeof record.sessions === 'object' && !Array.isArray(record.sessions)) {
    for (const [id, value] of Object.entries(record.sessions as Record<string, unknown>)) {
      const tagId = tagIdOf(value)
      if (tagId !== undefined && known.has(tagId)) sessions[id] = tagId
    }
  }

  const workspaces: Record<string, PersistedWorkspace> = {}
  if (record.workspaces !== null && typeof record.workspaces === 'object' && !Array.isArray(record.workspaces)) {
    for (const [id, value] of Object.entries(record.workspaces as Record<string, unknown>)) {
      const tagId = tagIdOf(value)
      if (tagId === undefined || !known.has(tagId)) continue
      const entry = value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
      workspaces[id] = {
        tagId,
        ...(typeof entry.path === 'string' && entry.path.length > 0 ? { path: entry.path.slice(0, 4096) } : {}),
      }
    }
  }

  return { version: STATE_VERSION, tags, sessions, workspaces }
}

function normalizeTags(value: unknown): PersistedTag[] | undefined {
  if (!Array.isArray(value)) return undefined
  const seen = new Set<string>()
  const tags: PersistedTag[] = []
  let order = 10
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object') continue
    const item = entry as Record<string, unknown>
    const id = typeof item.id === 'string' ? item.id.trim().slice(0, 64) : ''
    const label = typeof item.label === 'string' ? item.label.trim().slice(0, 48) : ''
    if (id.length === 0 || label.length === 0 || seen.has(id)) continue
    seen.add(id)
    tags.push({
      id,
      label,
      color: normalizeColor(item.color),
      order: typeof item.order === 'number' && Number.isInteger(item.order) && item.order >= 0 ? item.order : order,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
    })
    order += 10
  }
  return tags
}

/** Single-tag value; legacy arrays/objects collapse to their last entry. */
function tagIdOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      if (typeof value[index] === 'string') return value[index]
    }
    return undefined
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.tagId === 'string') return record.tagId
    if (Array.isArray(record.tagIds)) return tagIdOf(record.tagIds)
  }
  return undefined
}

function normalizeLabel(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, 'bad-label', 'label is required')
  const label = value.trim().replace(/\s+/g, ' ')
  if (label.length === 0 || label.length > 48) throw new HttpError(400, 'bad-label', 'label must be 1..48 characters')
  return label
}

function normalizeColor(value: unknown): string {
  if (typeof value !== 'string') return 'gray'
  const color = value.trim().toLowerCase()
  if (NAMED_COLORS.has(color)) return color
  if (/^#[0-9a-f]{6}$/.test(color)) return color
  return 'gray'
}

/** New and updated tags must use one of the ten preset colors. */
function requireColor(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, 'bad-color', 'color is required')
  const color = value.trim().toLowerCase()
  if (!NAMED_COLORS.has(color)) {
    throw new HttpError(400, 'bad-color', `color must be one of: ${[...NAMED_COLORS].join(', ')}`)
  }
  return color
}

function normalizeOrder(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new HttpError(400, 'bad-order', 'order must be a non-negative integer')
  }
  return value
}

function nextOrder(tags: PersistedTag[]): number {
  let max = 0
  for (const tag of tags) max = Math.max(max, tag.order)
  return max + 10
}

function newTagId(tags: PersistedTag[]): string {
  const existing = new Set(tags.map(tag => tag.id))
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const id = `tag_${randomSuffix()}`
    if (!RESERVED_IDS.has(id) && !existing.has(id)) return id
  }
  throw new HttpError(500, 'id-failed', 'could not allocate a tag id')
}

function randomSuffix(): string {
  const bytes = new Uint8Array(5)
  globalThis.crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64url').replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase()
}
