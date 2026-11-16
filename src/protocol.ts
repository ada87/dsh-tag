/** Wire contract shared by the host, the web client and paired phones. */

export const PROTOCOL_VERSION = 3
export const BODY_LIMIT = 32 * 1024

/**
 * Interface preferences stored with the tags so every client renders the same
 * sidebar. Missing fields fall back to the defaults on read.
 */
export interface TagSettings {
  /** Render the tag colour filter bar above the session list. */
  showFilter: boolean
}

export const DEFAULT_SETTINGS: TagSettings = { showFilter: true }

export interface Tag {
  id: string
  label: string
  color: string
  order: number
}

export interface WorkspaceTag {
  id: string
  path?: string
  tagId: string
}

/**
 * Read state per Session, shared by the web UI and every paired phone.
 *
 * - `readAt`: last time the Session was opened or explicitly marked read.
 * - `unread`: explicit "mark unread", cleared by the next read.
 * - `at`: when the entry last changed. Merges keep the newest entry, so a
 *   device that has been offline cannot roll back what another device did.
 */
export interface ReadEntry {
  readAt: number
  unread: boolean
  at: number
}

export interface ReadPatch {
  readAt?: number
  unread?: boolean
  at?: number
}

/**
 * Full tag state. Sessions are keyed by the dsh session id; workspaces carry
 * their path so the phone can match them even if it only knows paths.
 */
export interface Snapshot {
  version: number
  updatedAt: number
  settings: TagSettings
  tags: Tag[]
  sessions: Record<string, string>
  workspaces: WorkspaceTag[]
  /** Read watermarks; `reads[sessionId]` is absent until a Session is touched. */
  reads: Record<string, ReadEntry>
}

/** In-process service exposed as `ctx.provide('dsh-tag', …)` for dsh-door. */
export interface TagService {
  reads(): Record<string, ReadEntry>
  markRead(sessionId: string, patch: ReadPatch): ReadEntry
  mergeReads(entries: unknown): Record<string, ReadEntry>
}

export interface TagPatch {
  label?: string
  color?: string
  order?: number
}
