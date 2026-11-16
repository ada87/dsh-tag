import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { HttpError } from './errors.js'
import {
  checkOrigin,
  assertTrusted,
  readJson,
  sendJson,
  startSse,
  sseSend,
} from './http.js'
import type {
  HostContext,
  HostRequest,
  HostResponse,
  WebService,
  WorkspaceService,
} from './host.js'
import { openStore, type TagStore } from './store.js'
import type { ReadEntry, ReadPatch, Snapshot, TagPatch, TagService } from './protocol.js'

export const name = 'dsh-tag'
export const inject = ['webServer']

const BASE_PATH = '/tags'
const VERSION = readVersion()

/**
 * Color tags for sessions and workspaces.
 *
 * Reads are public (`GET /tags`) so the phone can consume the same snapshot
 * later; mutations require the dsh browser session, a same-origin browser
 * request, or loopback.
 */
export async function apply(ctx: HostContext): Promise<void> {
  const webServer = ctx.webServer ?? (ctx.get('webServer') as WebService | undefined)
  if (webServer === undefined) throw new Error('dsh-tag: the webServer service is required')

  const registry = ctx.get('workspaceRegistry') as WorkspaceService | undefined
  const workspacePath = (id: string): string | undefined => {
    try {
      const item = registry?.list?.().find(entry => String(entry.id) === id)
      return typeof item?.path === 'string' ? item.path : undefined
    } catch {
      return undefined
    }
  }

  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  const stateFile = join(home, 'state', 'dsh-tag.json')
  const store = openStore(stateFile, workspacePath)
  const hub = new SseHub()
  const handler = createHandler(ctx, store, hub)

  // dsh-door authenticates phone requests and forwards read changes here, so
  // the tag snapshot stays the single source of truth for colours and unread.
  ctx.provide?.('dsh-tag', {
    reads: () => store.reads(),
    markRead: (sessionId: string, patch: ReadPatch): ReadEntry => {
      const entry = store.markRead(sessionId, patch)
      hub.broadcast(store.snapshot())
      return entry
    },
    mergeReads: (entries: unknown): Record<string, ReadEntry> => {
      const reads = store.mergeReads(entries)
      hub.broadcast(store.snapshot())
      return reads
    },
  } satisfies TagService)

  ctx.effect(() => {
    const dispose = webServer.register({ kind: 'prefix', path: BASE_PATH, handler })
    console.log(`[dsh-tag] listening at ${BASE_PATH} (${stateFile})`)
    return () => {
      hub.closeAll()
      dispose()
    }
  }, 'dsh-tag: routes')
}

function createHandler(
  ctx: HostContext,
  store: TagStore,
  hub: SseHub,
): (req: HostRequest, res: HostResponse) => Promise<void> {
  return async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      checkOrigin(req)
      const method = (req.method ?? 'GET').toUpperCase()
      if (!url.pathname.startsWith(BASE_PATH)) throw notFound()
      const segments = pathSegments(url.pathname)

      // Reads -----------------------------------------------------------------
      if (method === 'GET') {
        if (segments.length === 0) {
          sendJson(res, 200, store.snapshot())
          return
        }
        if (segments.length === 1 && segments[0] === 'health') {
          const snapshot = store.snapshot()
          sendJson(res, 200, {
            ok: true,
            name: 'dsh-tag',
            version: VERSION,
            features: { sessions: true, workspaces: true, reads: true },
            tags: snapshot.tags.length,
            reads: Object.keys(snapshot.reads).length,
          })
          return
        }
        if (segments.length === 1 && segments[0] === 'reads') {
          sendJson(res, 200, { reads: store.reads() })
          return
        }
        if (segments.length === 1 && segments[0] === 'events') {
          hub.add(req, res, store.snapshot())
          return
        }
        throw notFound(method, url.pathname)
      }

      // Writes ----------------------------------------------------------------
      assertTrusted(ctx, req)

      if (method === 'POST' && segments.length === 0) {
        const input = await readBody(req)
        const tag = store.createTag(input.label, input.color)
        sendState(res, store, hub, 201, { tag })
        return
      }
      if (method === 'PATCH' && segments.length === 1) {
        if (segments[0] === 'settings') {
          const input = await readBody(req)
          const settings = store.updateSettings({
            ...(input.showFilter === undefined ? {} : { showFilter: input.showFilter }),
          })
          sendState(res, store, hub, 200, { settings })
          return
        }
        // The store validates every field; the cast only gives the route a type.
        const input = await readBody(req) as TagPatch
        const tag = store.updateTag(segments[0]!, {
          ...(input.label === undefined ? {} : { label: input.label }),
          ...(input.color === undefined ? {} : { color: input.color }),
          ...(input.order === undefined ? {} : { order: input.order }),
        })
        sendState(res, store, hub, 200, { tag })
        return
      }
      if (method === 'DELETE' && segments.length === 1) {
        store.deleteTag(segments[0]!)
        sendState(res, store, hub, 200, {})
        return
      }
      if (method === 'PUT' && segments.length === 2 && (segments[0] === 'sessions' || segments[0] === 'workspaces')) {
        const kind = segments[0] === 'sessions' ? 'session' : 'workspace'
        const input = await readBody(req)
        const tagId = input.tagId === null ? null : typeof input.tagId === 'string' ? input.tagId : undefined
        if (tagId === undefined) throw new HttpError(400, 'bad-tag', 'tagId must be a string or null')
        const path = typeof input.path === 'string' ? input.path : undefined
        store.assign(kind, segments[1]!, tagId, path)
        sendState(res, store, hub, 200, {})
        return
      }
      // Read watermarks: the web UI writes one Session, dsh-door forwards many.
      if (method === 'POST' && segments.length === 1 && segments[0] === 'reads') {
        const input = await readBody(req)
        const reads = store.mergeReads(input.sessions ?? input)
        sendState(res, store, hub, 200, { reads })
        return
      }
      if ((method === 'PUT' || method === 'POST') && segments.length === 2 && segments[0] === 'reads') {
        const input = await readBody(req)
        const read = store.markRead(segments[1]!, {
          ...(typeof input.readAt === 'number' ? { readAt: input.readAt } : {}),
          ...(typeof input.unread === 'boolean' ? { unread: input.unread } : {}),
          ...(typeof input.at === 'number' ? { at: input.at } : {}),
        })
        sendState(res, store, hub, 200, { read })
        return
      }

      throw notFound(method, url.pathname)
    } catch (error) {
      if (res.headersSent) {
        try {
          res.end()
        } catch {
          // The client is gone.
        }
        console.warn('[dsh-tag] stream failed:', error instanceof Error ? error.message : String(error))
        return
      }
      if (error instanceof HttpError) {
        sendJson(res, error.status, { error: { code: error.code, message: error.message } })
        return
      }
      console.warn('[dsh-tag] request failed:', error instanceof Error ? error.message : String(error))
      sendJson(res, 500, { error: { code: 'internal', message: 'internal error' } })
    }
  }
}

function pathSegments(pathname: string): string[] {
  try {
    return pathname
      .slice(BASE_PATH.length)
      .split('/')
      .filter(segment => segment.length > 0)
      .map(segment => decodeURIComponent(segment))
  } catch {
    throw new HttpError(400, 'bad-path', 'the request path is not valid')
  }
}

/** Route bodies are JSON objects; arrays and scalars never carry fields. */
async function readBody(req: HostRequest): Promise<Record<string, unknown>> {
  const value = await readJson(req)
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function notFound(method?: string, pathname?: string): HttpError {
  return new HttpError(404, 'not-found', method === undefined ? 'not found' : `no route for ${method} ${pathname}`)
}

function sendState(
  res: HostResponse,
  store: TagStore,
  hub: SseHub,
  status: number,
  extra: Record<string, unknown>,
): void {
  const snapshot = store.snapshot()
  hub.broadcast(snapshot)
  sendJson(res, status, { ok: true, ...extra, snapshot })
}

class SseHub {
  private readonly clients = new Map<HostResponse, () => void>()

  add(req: HostRequest, res: HostResponse, snapshot: Snapshot): void {
    startSse(res)
    let timer: ReturnType<typeof setInterval> | undefined
    const cleanup = (): void => {
      this.clients.delete(res)
      if (timer !== undefined) {
        clearInterval(timer)
        timer = undefined
      }
    }
    this.clients.set(res, cleanup)
    res.on('close', cleanup)
    res.on('error', cleanup)
    req.on('close', cleanup)
    try {
      sseSend(res, snapshot)
    } catch (error) {
      cleanup()
      throw error
    }
    timer = setInterval(() => {
      try {
        res.write(': ping\n\n')
      } catch {
        cleanup()
      }
    }, 20_000)
    ;(timer as { unref?: () => void }).unref?.()
  }

  broadcast(snapshot: Snapshot): void {
    for (const [res, cleanup] of [...this.clients]) {
      if (res.writableEnded || res.destroyed === true) {
        cleanup()
        continue
      }
      try {
        sseSend(res, snapshot)
      } catch {
        cleanup()
      }
    }
  }

  closeAll(): void {
    for (const [res, cleanup] of [...this.clients]) {
      cleanup()
      try {
        res.end()
      } catch {
        // The client is gone.
      }
    }
    this.clients.clear()
  }
}

function readVersion(): string {
  try {
    const text = readFileSync(new URL('../package.json', import.meta.url), 'utf8')
    const parsed = JSON.parse(text) as { version?: unknown }
    return typeof parsed.version === 'string' ? parsed.version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}
