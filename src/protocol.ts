/** Wire contract shared by the host, the web client and (later) the app. */

export const PROTOCOL_VERSION = 2
export const MAX_BODY_BYTES = 32 * 1024

/**
 * Interface preferences stored with the tags so every client renders the same
 * sidebar. Missing fields fall back to the defaults on read.
 */
export interface TagSettings {
  /** Render the tag colour filter bar above the session list. */
  showFilter: boolean
}

export const DEFAULT_SETTINGS: TagSettings = { showFilter: true }

/** Stored tag definition. `id` is the record key, not part of the value. */
export interface TagValue {
  label: string
  color: string
  order: number
  createdAt: number
}

/** Stored assignment. The record key is `session:<id>` or `workspace:<id>`. */
export interface AssignmentValue {
  targetId: string
  tagId: string
  path?: string
  updatedAt: number
}

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
}

export interface TagPatch {
  label?: string
  color?: string
  order?: number
}
