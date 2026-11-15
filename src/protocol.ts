/** Wire contract shared by the host, the web client and (later) the app. */

export const PROTOCOL_VERSION = 1
export const MAX_BODY_BYTES = 32 * 1024

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
  tags: Tag[]
  sessions: Record<string, string>
  workspaces: WorkspaceTag[]
}

export interface TagPatch {
  label?: string
  color?: string
  order?: number
}
