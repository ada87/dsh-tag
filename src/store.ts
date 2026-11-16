import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { HttpError } from './errors.js'
import {
  DEFAULT_SETTINGS,
  PROTOCOL_VERSION,
  type ReadEntry,
  type ReadPatch,
  type Snapshot,
  type Tag,
  type TagPatch,
  type TagSettings,
  type WorkspaceTag,
} from './protocol.js'

const NAMED_COLORS = new Set([
  'green', 'amber', 'blue', 'red', 'purple',
  'gray', 'teal', 'pink', 'indigo', 'brown',
])
const MAX_TAGS = 10
const MAX_READS = 500
const STATE_VERSION = 3

/**
 * Business-oriented defaults; IDs stay stable so assignments survive renames.
 * Only the labels follow the host language, and only when the state file is
 * first created — they are ordinary tags the user can rename afterwards.
 */
const DEFAULT_TAGS: ReadonlyArray<readonly [id: string, color: string]> = [
  ['design', 'purple'],
  ['code', 'blue'],
  ['ops', 'green'],
  ['temp', 'gray'],
]

const DEFAULT_LABELS: Record<string, Record<string, string>> = {
  en: { design: 'Design', code: 'Code', ops: 'Ops', temp: 'Temp' },
  zh: { design: '设计', code: '编码', ops: '运营', temp: '临时' },
  ja: { design: 'デザイン', code: 'コード', ops: '運用', temp: '一時的' },
  es: { design: 'Diseño', code: 'Código', ops: 'Operaciones', temp: 'Temporal' },
  fr: { design: 'Design', code: 'Code', ops: 'Ops', temp: 'Temporaire' },
  de: { design: 'Design', code: 'Code', ops: 'Betrieb', temp: 'Temporär' },
  ru: { design: 'Дизайн', code: 'Код', ops: 'Эксплуатация', temp: 'Временное' },
  pt: { design: 'Design', code: 'Código', ops: 'Operações', temp: 'Temporário' },
}

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
  settings: TagSettings
  tags: PersistedTag[]
  sessions: Record<string, string>
  workspaces: Record<string, PersistedWorkspace>
  reads: Record<string, ReadEntry>
}

export interface TagStore {
  snapshot(): Snapshot
  createTag(label: unknown, color: unknown): Tag
  updateTag(id: string, patch: TagPatch): Tag
  deleteTag(id: string): void
  assign(kind: 'session' | 'workspace', targetId: string, tagId: string | null, path?: string): void
  updateSettings(patch: { showFilter?: unknown }): TagSettings
  /** Current read watermarks, newest first is not required. */
  reads(): Record<string, ReadEntry>
  /** Apply one explicit read/unread change and return the stored entry. */
  markRead(sessionId: string, patch: ReadPatch): ReadEntry
  /** Merge a device's map; a newer `at` wins. Returns the merged map. */
  mergeReads(input: unknown): Record<string, ReadEntry>
}

/**
 * State lives in `<DSH_HOME>/state/dsh-tag.json`. A file keeps the plugin
 * independent of the storage-domain composition, which is not mounted in
 * every profile.
 */
export function openStore(
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

  /** The public tag shape, ordered by `order` so the API and UI agree. */
  const tags = (): Tag[] => [...state.tags]
    .sort((left, right) => left.order - right.order || left.createdAt - right.createdAt)
    .map(toTag)

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
    return {
      version: PROTOCOL_VERSION,
      updatedAt: Date.now(),
      settings: { ...state.settings },
      tags: list,
      sessions,
      workspaces,
      reads: { ...state.reads },
    }
  }

  /** A tag owns one palette color; the message is shared by create and update. */
  const checkColor = (color: string, exceptId?: string): void => {
    if (state.tags.some(tag => tag.id !== exceptId && tag.color === color)) {
      throw new HttpError(409, 'color-in-use', `color "${color}" is already used`)
    }
  }

  const createTag = (rawLabel: unknown, rawColor: unknown): Tag => {
    if (state.tags.length >= MAX_TAGS) {
      throw new HttpError(409, 'tag-limit', `at most ${MAX_TAGS} tags are supported`)
    }
    const label = normalizeLabel(rawLabel)
    const color = requireColor(rawColor)
    checkColor(color)
    const tag: PersistedTag = {
      id: makeId(state.tags),
      label,
      color,
      order: nextOrder(state.tags),
      createdAt: Date.now(),
    }
    save({ ...state, tags: [...state.tags, tag] })
    return toTag(tag)
  }

  const updateTag = (id: string, patch: TagPatch): Tag => {
    const index = state.tags.findIndex(tag => tag.id === id)
    if (index === -1) throw new HttpError(404, 'tag-not-found', `no tag "${id}"`)
    const current = state.tags[index]!
    const color = patch.color === undefined ? current.color : requireColor(patch.color)
    if (color !== current.color) checkColor(color, id)
    const next: PersistedTag = {
      ...current,
      ...(patch.label === undefined ? {} : { label: normalizeLabel(patch.label) }),
      color,
      ...(patch.order === undefined ? {} : { order: normalizeOrder(patch.order) }),
    }
    const list = [...state.tags]
    list[index] = next
    save({ ...state, tags: list })
    return toTag(next)
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
      workspaces[workspaceId] = {
        tagId: assignment.tagId,
        ...(assignment.path === undefined ? {} : { path: assignment.path }),
      }
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

  const updateSettings = (patch: { showFilter?: unknown }): TagSettings => {
    const next: TagSettings = { ...state.settings }
    if (patch.showFilter !== undefined) {
      if (typeof patch.showFilter !== 'boolean') {
        throw new HttpError(400, 'bad-settings', 'showFilter must be a boolean')
      }
      next.showFilter = patch.showFilter
    }
    save({ ...state, settings: next })
    return { ...next }
  }

  const reads = (): Record<string, ReadEntry> => ({ ...state.reads })

  /** Writes clamp `at` so one device with a fast clock cannot win forever. */
  const clampAt = (at: number): number => Math.min(at, Date.now() + 60_000)

  const markRead = (sessionId: string, patch: ReadPatch): ReadEntry => {
    const id = sessionId.trim()
    if (id.length === 0 || id.length > 256) throw new HttpError(400, 'bad-target', 'a non-empty target id is required')
    const current = state.reads[id]
    const at = typeof patch.at === 'number' && Number.isFinite(patch.at) && patch.at >= 0
      ? clampAt(patch.at)
      : Date.now()
    const readAt = readNumber(patch.readAt) ?? current?.readAt ?? 0
    const unread = typeof patch.unread === 'boolean' ? patch.unread : current?.unread ?? false
    const entry: ReadEntry = { readAt, unread, at }
    save({ ...state, reads: capReads({ ...state.reads, [id]: entry }) })
    return { ...entry }
  }

  const mergeReads = (input: unknown): Record<string, ReadEntry> => {
    if (!isRecord(input)) throw new HttpError(400, 'bad-reads', 'reads must be an object')
    const next: Record<string, ReadEntry> = { ...state.reads }
    let changed = false
    for (const [id, value] of Object.entries(input)) {
      const key = id.trim()
      if (key.length === 0 || key.length > 256) continue
      const entry = normalizeReadEntry(value)
      if (entry === undefined) continue
      const at = clampAt(entry.at)
      const current = next[key]
      if (current !== undefined && current.at >= at) continue
      next[key] = { ...entry, at }
      changed = true
    }
    if (changed) save({ ...state, reads: capReads(next) })
    return { ...state.reads }
  }

  return { snapshot, createTag, updateTag, deleteTag, assign, updateSettings, reads, markRead, mergeReads }
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
  const labels = DEFAULT_LABELS[hostLanguage()] ?? DEFAULT_LABELS.en!
  let order = 10
  const tags: PersistedTag[] = DEFAULT_TAGS.map(([id, color]) => {
    const tag = { id, label: labels[id] ?? id, color, order, createdAt: now }
    order += 10
    return tag
  })
  return {
    version: STATE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    tags,
    sessions: {},
    workspaces: {},
    reads: {},
  }
}

/**
 * The host cannot see the browser's language, so fresh installs follow the
 * machine locale. Anything unsupported falls back to English; the labels stay
 * editable, so this only decides what the first run looks like.
 */
function hostLanguage(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    const language = locale.split('-')[0]?.toLowerCase() ?? ''
    return DEFAULT_LABELS[language] === undefined ? 'en' : language
  } catch {
    return 'en'
  }
}

function normalizeState(raw: unknown): PersistedState {
  if (!isRecord(raw)) return seed()
  const tags = normalizeTags(raw.tags) ?? seed().tags
  const known = new Set(tags.map(tag => tag.id))

  const sessions: Record<string, string> = {}
  if (isRecord(raw.sessions)) {
    for (const [id, value] of Object.entries(raw.sessions)) {
      const tagId = readTag(value)
      if (tagId !== undefined && known.has(tagId)) sessions[id] = tagId
    }
  }

  const workspaces: Record<string, PersistedWorkspace> = {}
  if (isRecord(raw.workspaces)) {
    for (const [id, value] of Object.entries(raw.workspaces)) {
      const tagId = readTag(value)
      if (tagId === undefined || !known.has(tagId)) continue
      const entry = isRecord(value) ? value : {}
      workspaces[id] = {
        tagId,
        ...(typeof entry.path === 'string' && entry.path.length > 0 ? { path: entry.path.slice(0, 4096) } : {}),
      }
    }
  }

  return {
    version: STATE_VERSION,
    settings: normalizeSettings(raw.settings),
    tags,
    sessions,
    workspaces,
    reads: normalizeReads(raw.reads),
  }
}

/** Reads are additive: an older file simply has none. */
function normalizeReads(value: unknown): Record<string, ReadEntry> {
  const reads: Record<string, ReadEntry> = {}
  if (!isRecord(value)) return reads
  for (const [id, entry] of Object.entries(value)) {
    const key = id.trim()
    if (key.length === 0 || key.length > 256) continue
    const normalized = normalizeReadEntry(entry)
    if (normalized !== undefined) reads[key] = normalized
  }
  return capReads(reads)
}

function normalizeReadEntry(value: unknown): ReadEntry | undefined {
  if (!isRecord(value)) return undefined
  const readAt = readNumber(value.readAt)
  const at = readNumber(value.at)
  if (readAt === undefined || at === undefined) return undefined
  return { readAt, unread: value.unread === true, at }
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/** Keep the shared map small; the sidebar only shows recent Sessions. */
function capReads(reads: Record<string, ReadEntry>): Record<string, ReadEntry> {
  const entries = Object.entries(reads)
  if (entries.length <= MAX_READS) return reads
  return Object.fromEntries(entries.sort((left, right) => right[1].at - left[1].at).slice(0, MAX_READS))
}

/** Settings are additive: an older file simply lacks them. */
function normalizeSettings(value: unknown): TagSettings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS }
  return {
    showFilter: typeof value.showFilter === 'boolean' ? value.showFilter : DEFAULT_SETTINGS.showFilter,
  }
}

function normalizeTags(value: unknown): PersistedTag[] | undefined {
  if (!Array.isArray(value)) return undefined
  const seen = new Set<string>()
  const tags: PersistedTag[] = []
  let order = 10
  for (const entry of value) {
    if (!isRecord(entry)) continue
    const id = typeof entry.id === 'string' ? entry.id.trim().slice(0, 64) : ''
    const label = typeof entry.label === 'string' ? entry.label.trim().slice(0, 48) : ''
    if (id.length === 0 || label.length === 0 || seen.has(id)) continue
    seen.add(id)
    tags.push({
      id,
      label,
      color: normalizeColor(entry.color),
      order: typeof entry.order === 'number' && Number.isInteger(entry.order) && entry.order >= 0 ? entry.order : order,
      createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : Date.now(),
    })
    order += 10
  }
  return tags
}

/** Single-tag value; legacy arrays/objects collapse to their last entry. */
function readTag(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      if (typeof value[index] === 'string') return value[index]
    }
    return undefined
  }
  if (isRecord(value)) {
    if (typeof value.tagId === 'string') return value.tagId
    if (Array.isArray(value.tagIds)) return readTag(value.tagIds)
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

function makeId(tags: PersistedTag[]): string {
  const existing = new Set(tags.map(tag => tag.id))
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const id = `tag_${randomSuffix()}`
    if (!existing.has(id)) return id
  }
  throw new HttpError(500, 'id-failed', 'could not allocate a tag id')
}

function randomSuffix(): string {
  const bytes = new Uint8Array(5)
  globalThis.crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('hex')
}

function toTag(tag: PersistedTag): Tag {
  return { id: tag.id, label: tag.label, color: tag.color, order: tag.order }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
